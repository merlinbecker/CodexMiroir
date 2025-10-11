
import { app } from "@azure/functions";
import { withIdLock } from "../shared/id.js";
import { putTextBlob, getTextBlob, invalidateCacheForUser } from "../shared/storage.js";
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

function buildMarkdown(payload) {
  const fm = {
    typ: "task",
    kategorie: payload.kategorie,
    status: payload.status || "offen",
    tags: payload.tags || [],
    fixedSlot: payload.fixedSlot || null
  };
  
  const yaml = [
    "---",
    `typ: ${fm.typ}`,
    `kategorie: ${fm.kategorie}`,
    `status: ${fm.status}`,
    `tags: ${Array.isArray(fm.tags) ? `[${fm.tags.join(", ")}]` : "[]"}`,
    fm.fixedSlot 
      ? `fixedSlot:\n  datum: ${fm.fixedSlot.datum}\n  zeit: ${fm.fixedSlot.zeit}` 
      : "fixedSlot: null",
    "---"
  ].join("\n");
  
  const body = (payload.body || "").trim();
  return `${yaml}\n\n${body}\n`;
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

async function commitFile(path, content, message, branch) {
  return gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, "PUT", {
    message,
    content: b64(content),
    branch,
    committer: COMMITTER
  });
}

async function openPr(fromBranch, toBranch, title, body) {
  return gh(`/repos/${OWNER}/${REPO}/pulls`, "POST", { 
    title, 
    head: fromBranch, 
    base: toBranch, 
    body 
  });
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

app.http("createTask", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "api/tasks",
  handler: async (request, context) => {
    try {
      // Validate OAuth2 token and extract userId
      const { userId, error } = await validateAuth(request);
      if (error) {
        return error;
      }
      
      const idemKey = request.headers.get("idempotency-key");
      const p = await request.json();

      // Validierung
      const kat = p.kategorie;
      if (!["arbeit", "privat"].includes(kat)) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "kategorie muss 'arbeit' oder 'privat' sein" }
        };
      }
      
      if (p.fixedSlot) {
        if (!isDate(p.fixedSlot.datum)) {
          return {
            status: 400,
            jsonBody: { ok: false, error: "fixedSlot.datum muss dd.mm.yyyy sein" }
          };
        }
        if (!slotOk(p.fixedSlot.zeit)) {
          return {
            status: 400,
            jsonBody: { ok: false, error: "fixedSlot.zeit muss morgens|nachmittags|abends sein" }
          };
        }
      }

      // Idempotenz-Check
      if (idemKey) {
        const prior = await getTextBlob(`state/idempotency/${idemKey}.txt`);
        if (prior) {
          const id = prior.trim();
          return {
            status: 200,
            jsonBody: { 
              ok: true, 
              id, 
              path: `${BASE}/tasks/${id}.md`, 
              reused: true 
            }
          };
        }
      }

      // ID vergeben
      const id = await withIdLock(userId);
      
      // Extrahiere Titel aus dem Body (erste Zeile oder ersten 50 Zeichen)
      const bodyLines = (p.body || "").trim().split('\n');
      let title = bodyLines[0] || "untitled";
      
      // Bereinige Titel für Dateinamen (entferne Sonderzeichen, ersetze Leerzeichen)
      title = title
        .replace(/^#*\s*/, '') // Entferne führende # für Markdown-Überschriften
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '') // Nur Buchstaben, Zahlen, Umlaute, Leerzeichen, Bindestriche
        .replace(/\s+/g, '-') // Ersetze Leerzeichen durch Bindestriche
        .substring(0, 50) // Maximal 50 Zeichen
        .replace(/-+$/, ''); // Entferne trailing Bindestriche
      
      const filename = `${id}-${title}.md`;
      const path = `${BASE}/${userId}/tasks/${filename}`;
      
      // Safety check: Prüfe ob diese ID bereits in GitHub existiert
      try {
        await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`);
        // File existiert bereits! Das sollte nicht passieren
        throw new Error(`Task ${id} already exists in repository`);
      } catch (e) {
        if (e.message && !e.message.includes("404")) {
          throw e; // Anderer Fehler als 404
        }
        // 404 ist gut - File existiert noch nicht
      }
      
      const md = buildMarkdown(p);
      const message = `[codex] add task ${id} (${kat})`;

      let result;
      let gitPushed = false;
      
      // Check if user has GitHub configured (OWNER, REPO, TOKEN must be set)
      const hasGitConfig = OWNER && REPO && TOKEN;
      
      if (hasGitConfig) {
        context.log(`[createTask] Pushing to GitHub (VIA_PR: ${VIA_PR})`);
        
        if (VIA_PR) {
          // Feature-Branch je Task erstellen → Pull Request
          const feat = `${PR_PREFIX}/${id}`;
          await ensureBranch(BRANCH, feat);
          result = await commitFile(path, md, message, feat);
          const pr = await openPr(feat, BRANCH, message, `Automatisch erstellt.\n\n${path}`);
          
          // PR-URL zur Response hinzufügen
          result.prUrl = pr.html_url;
          result.prNumber = pr.number;
          gitPushed = true;
        } else {
          // Direct push zu main/default branch
          result = await commitFile(path, md, message, BRANCH);
          gitPushed = true;
        }
      } else {
        context.log(`[createTask] No GitHub config found - skipping Git push (storage-only mode)`);
      }

      // Idempotenz-Key persistieren
      if (idemKey) {
        await putTextBlob(`state/idempotency/${idemKey}.txt`, id, "text/plain");
      }

      // Storage-Update: Speichere Task im Blob Storage
      await putTextBlob(`raw/${userId}/tasks/${filename}`, md, "text/markdown");
      context.log(`[createTask] Task saved to storage: raw/${userId}/tasks/${filename}`);

      // Cache-Invalidierung: Nur betroffenen User-Cache invalidieren
      const cacheInvalidation = await invalidateCacheForUser(userId);
      context.log(`[createTask] Cache invalidated for user ${userId}: ${JSON.stringify(cacheInvalidation)}`);

      const response = {
        ok: true,
        id,
        path,
        filename,
        gitPushed
      };
      
      // Git-Info hinzufügen wenn gepusht wurde
      if (gitPushed && result) {
        response.commitSha = result.commit.sha;
        response.htmlUrl = result.content.html_url;
        
        // PR-Info hinzufügen wenn via PR erstellt wurde
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
