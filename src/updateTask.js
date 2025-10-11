
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

function isDate(s) {
  return /^\d{2}\.\d{2}\.\d{4}$/.test(s || "");
}

function slotOk(z) {
  return ["morgens", "nachmittags", "abends"].includes((z || "").toLowerCase());
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

function updateMarkdown(existingMd, updates) {
  const lines = existingMd.split('\n');
  const yamlStart = lines.indexOf('---');
  const yamlEnd = lines.indexOf('---', yamlStart + 1);
  
  if (yamlStart === -1 || yamlEnd === -1) {
    throw new Error("Invalid markdown format: missing YAML frontmatter");
  }
  
  const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
  const bodyLines = lines.slice(yamlEnd + 1);
  
  // Update YAML fields
  const newYaml = yamlLines.map(line => {
    if (updates.kategorie && line.startsWith('kategorie:')) {
      return `kategorie: ${updates.kategorie}`;
    }
    if (updates.status && line.startsWith('status:')) {
      return `status: ${updates.status}`;
    }
    if (updates.tags && line.startsWith('tags:')) {
      return `tags: [${updates.tags.join(', ')}]`;
    }
    return line;
  });
  
  // Handle fixedSlot updates
  if (updates.fixedSlot !== undefined) {
    const fixedSlotIndex = newYaml.findIndex(l => l.includes('fixedSlot:'));
    if (updates.fixedSlot === null) {
      // Remove fixedSlot
      if (fixedSlotIndex !== -1) {
        newYaml.splice(fixedSlotIndex, 3);
      }
      newYaml.push('fixedSlot: null');
    } else {
      // Update or add fixedSlot
      if (fixedSlotIndex !== -1) {
        newYaml.splice(fixedSlotIndex, 3);
      }
      newYaml.push(`fixedSlot:`);
      newYaml.push(`  datum: ${updates.fixedSlot.datum}`);
      newYaml.push(`  zeit: ${updates.fixedSlot.zeit}`);
    }
  }
  
  // Update body if provided
  const finalBody = updates.body !== undefined ? updates.body : bodyLines.join('\n');
  
  return ['---', ...newYaml, '---', '', finalBody].join('\n');
}

app.http("updateTask", {
  methods: ["PUT", "PATCH"],
  authLevel: "anonymous",
  route: "api/tasks/{id}",
  handler: async (request, context) => {
    try {
      // Validate OAuth2 token and extract userId
      const { userId, error } = await validateAuth(request);
      if (error) {
        return error;
      }
      
      const id = request.params.id;
      const updates = await request.json();
      
      // Validierung
      if (updates.kategorie && !["arbeit", "privat"].includes(updates.kategorie)) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "kategorie muss 'arbeit' oder 'privat' sein" }
        };
      }
      
      if (updates.fixedSlot) {
        if (!isDate(updates.fixedSlot.datum)) {
          return {
            status: 400,
            jsonBody: { ok: false, error: "fixedSlot.datum muss dd.mm.yyyy sein" }
          };
        }
        if (!slotOk(updates.fixedSlot.zeit)) {
          return {
            status: 400,
            jsonBody: { ok: false, error: "fixedSlot.zeit muss morgens|nachmittags|abends sein" }
          };
        }
      }
      
      const path = `${BASE}/${userId}/tasks/${id}.md`;
      
      // Check if user has GitHub configured
      const hasGitConfig = OWNER && REPO && TOKEN;
      
      let gitPushed = false;
      let result;
      let currentMd;
      
      if (hasGitConfig) {
        context.log(`[updateTask] Fetching current file from GitHub`);
        // Get current file from GitHub
        const fileData = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`);
        currentMd = Buffer.from(fileData.content, 'base64').toString('utf8');
        
        // Update markdown
        const newMd = updateMarkdown(currentMd, updates);
        
        const message = `[codex] update task ${id}`;
        
        if (VIA_PR) {
          // Feature-Branch für Update erstellen → Pull Request
          const feat = `${PR_PREFIX}/${id}-update`;
          await ensureBranch(BRANCH, feat);
          
          result = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, "PUT", {
            message,
            content: b64(newMd),
            sha: fileData.sha,
            branch: feat,
            committer: COMMITTER
          });
          
          const pr = await openPr(feat, BRANCH, message, `Automatisch aktualisiert.\n\n${path}`);
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
        context.log(`[updateTask] Task updated in storage: raw/${userId}/tasks/${id}.md`);
      } else {
        context.log(`[updateTask] No GitHub config - storage-only mode`);
        // Storage-only Mode: Lese von Storage, update, speichere zurück
        currentMd = await getTextBlob(`raw/${userId}/tasks/${id}.md`);
        if (!currentMd) {
          return {
            status: 404,
            jsonBody: { ok: false, error: `Task ${id} not found in storage` }
          };
        }
        
        const newMd = updateMarkdown(currentMd, updates);
        await putTextBlob(`raw/${userId}/tasks/${id}.md`, newMd, "text/markdown");
        context.log(`[updateTask] Task updated in storage (no Git): raw/${userId}/tasks/${id}.md`);
      }
      
      // Cache-Invalidierung: Nur betroffenen User-Cache invalidieren
      const cacheInvalidation = await invalidateCacheForUser(userId);
      context.log(`[updateTask] Cache invalidated for user ${userId}: ${JSON.stringify(cacheInvalidation)}`);
      
      const response = {
        ok: true,
        id,
        gitPushed
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
