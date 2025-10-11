
import { app } from "@azure/functions";
import { getTextBlob, putTextBlob, invalidateCacheForUser } from "../shared/storage.js";
import { validateAuth } from "../shared/auth.js";

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_DEFAULT_BRANCH || process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN;
const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(/\/+$/, "");
const VIA_PR = (process.env.CREATE_VIA_PR || "false").toLowerCase() === "true";
const PR_PREFIX = process.env.GITHUB_PR_BRANCH_PREFIX || "codex/tasks";

const COMMITTER = {
  name: process.env.GITHUB_COMMITTER_NAME || "Codex Miroir Bot",
  email: process.env.GITHUB_COMMITTER_EMAIL || "bot@example.com"
};

function b64(s) {
  return Buffer.from(s, "utf8").toString("base64");
}

async function gh(url, method = "GET", body) {
  const r = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "User-Agent": "codex-miroir",
      "Accept": "application/vnd.github.v3+json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`GitHub ${r.status} ${url} :: ${txt}`);
  }
  
  return r.json();
}

async function ensureBranch(base, feature) {
  const baseRef = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${base}`);
  const sha = baseRef.object.sha;
  
  try {
    await gh(`/repos/${OWNER}/${REPO}/git/refs`, "POST", { 
      ref: `refs/heads/${feature}`, 
      sha 
    });
  } catch (e) {
    // Branch might already exist
  }
  
  return feature;
}

async function openPr(fromBranch, toBranch, title, body) {
  return gh(`/repos/${OWNER}/${REPO}/pulls`, "POST", { 
    title, 
    head: fromBranch, 
    base: toBranch, 
    body 
  });
}

function markAsCompleted(existingMd, completedDate, completedSlot) {
  const lines = existingMd.split('\n');
  const yamlStart = lines.indexOf('---');
  const yamlEnd = lines.indexOf('---', yamlStart + 1);
  
  if (yamlStart === -1 || yamlEnd === -1) {
    throw new Error("Invalid markdown format: missing YAML frontmatter");
  }
  
  const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
  const bodyLines = lines.slice(yamlEnd + 1);
  
  // Update status and add abgeschlossen_am
  const newYaml = yamlLines.map(line => {
    if (line.startsWith('status:')) {
      return 'status: abgeschlossen';
    }
    return line;
  });
  
  // Add abgeschlossen_am after status
  const statusIndex = newYaml.findIndex(l => l.startsWith('status:'));
  if (statusIndex !== -1) {
    newYaml.splice(statusIndex + 1, 0, `abgeschlossen_am:`);
    newYaml.splice(statusIndex + 2, 0, `  datum: ${completedDate}`);
    newYaml.splice(statusIndex + 3, 0, `  zeit: ${completedSlot}`);
  }
  
  return ['---', ...newYaml, '---', '', bodyLines.join('\n')].join('\n');
}

app.http("completeTask", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/tasks/{id}/complete",
  handler: async (request, context) => {
    try {
      // Validate OAuth2 token and extract userId
      const { userId, error } = await validateAuth(request);
      if (error) {
        return error;
      }
      
      const id = request.params.id;
      const body = await request.json();
      const { datum, zeit } = body || {};
      
      if (!datum || !zeit) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "datum und zeit erforderlich" }
        };
      }
      
      // Validate slot
      if (!["morgens", "nachmittags", "abends"].includes(zeit)) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "zeit muss morgens|nachmittags|abends sein" }
        };
      }
      
      const path = `${BASE}/${userId}/tasks/${id}.md`;
      
      // Check if user has GitHub configured
      const hasGitConfig = OWNER && REPO && TOKEN;
      
      let gitPushed = false;
      let result;
      let currentMd;
      
      if (hasGitConfig) {
        context.log(`[completeTask] Fetching current file from GitHub`);
        // Get current file from GitHub
        const fileData = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`);
        currentMd = Buffer.from(fileData.content, 'base64').toString('utf8');
        
        // Mark as completed
        const newMd = markAsCompleted(currentMd, datum, zeit);
        
        const message = `[codex] complete task ${id}`;
        
        if (VIA_PR) {
          // Feature-Branch für Completion erstellen → Pull Request
          const feat = `${PR_PREFIX}/${id}-complete`;
          await ensureBranch(BRANCH, feat);
          
          result = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, "PUT", {
            message,
            content: b64(newMd),
            sha: fileData.sha,
            branch: feat,
            committer: COMMITTER
          });
          
          const pr = await openPr(feat, BRANCH, message, `Task als abgeschlossen markiert.\n\n${path}`);
          result.prUrl = pr.html_url;
          result.prNumber = pr.number;
          gitPushed = true;
        } else {
          // Direct push zu main/default branch
          result = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, "PUT", {
            message,
            content: b64(newMd),
            sha: fileData.sha,
            branch: BRANCH,
            committer: COMMITTER
          });
          gitPushed = true;
        }
        
        // Update Storage mit neuer Version
        await putTextBlob(`raw/${userId}/tasks/${id}.md`, newMd, "text/markdown");
        context.log(`[completeTask] Task marked as completed in storage: raw/${userId}/tasks/${id}.md`);
      } else {
        context.log(`[completeTask] No GitHub config - storage-only mode`);
        // Storage-only Mode: Lese von Storage, update, speichere zurück
        currentMd = await getTextBlob(`raw/${userId}/tasks/${id}.md`);
        if (!currentMd) {
          return {
            status: 404,
            jsonBody: { ok: false, error: `Task ${id} not found in storage` }
          };
        }
        
        const newMd = markAsCompleted(currentMd, datum, zeit);
        await putTextBlob(`raw/${userId}/tasks/${id}.md`, newMd, "text/markdown");
        context.log(`[completeTask] Task marked as completed in storage (no Git): raw/${userId}/tasks/${id}.md`);
      }
      
      // Cache-Invalidierung: Nur betroffenen User-Cache invalidieren
      const cacheInvalidation = await invalidateCacheForUser(userId);
      context.log(`[completeTask] Cache invalidated for user ${userId}: ${JSON.stringify(cacheInvalidation)}`);
      
      const response = {
        ok: true,
        id,
        gitPushed,
        completedAt: { datum, zeit }
      };
      
      if (gitPushed && result) {
        response.commitSha = result.commit.sha;
        response.htmlUrl = result.content.html_url;
        
        if (VIA_PR && result.prUrl) {
          response.prUrl = result.prUrl;
          response.prNumber = result.prNumber;
        }
      }
      
      return {
        status: 200,
        jsonBody: response
      };
      
    } catch (e) {
      context.log("Error:", e);
      return {
        status: 500,
        jsonBody: { ok: false, error: String(e.message || e) }
      };
    }
  }
});
