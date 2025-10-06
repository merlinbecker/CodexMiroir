
import { app } from "@azure/functions";
import { withIdLock } from "../shared/id.js";
import { putTextBlob, getTextBlob } from "../shared/storage.js";

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
    deadline: payload.deadline || null,
    fixedSlot: payload.fixedSlot || null
  };
  
  const yaml = [
    "---",
    `typ: ${fm.typ}`,
    `kategorie: ${fm.kategorie}`,
    `status: ${fm.status}`,
    `tags: ${Array.isArray(fm.tags) ? `[${fm.tags.join(", ")}]` : "[]"}`,
    `deadline: ${fm.deadline ? fm.deadline : "null"}`,
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
  route: "tasks",
  handler: async (request, context) => {
    try {
      const idemKey = request.headers.get("idempotency-key");
      const p = await request.json();

      // Validierung
      const kat = p.kategorie;
      if (!["geschäftlich", "privat"].includes(kat)) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "kategorie muss 'geschäftlich' oder 'privat' sein" }
        };
      }
      
      if (p.deadline && !isDate(p.deadline)) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "deadline muss dd.mm.yyyy sein" }
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
      const id = await withIdLock();
      const path = `${BASE}/tasks/${id}.md`;
      const md = buildMarkdown(p);
      const message = `[codex] add task ${id} (${kat})`;

      let result;
      
      if (VIA_PR) {
        // Feature-Branch je Task
        const feat = `${PR_PREFIX}/${id}`;
        await ensureBranch(BRANCH, feat);
        result = await commitFile(path, md, message, feat);
        await openPr(feat, BRANCH, message, `Automatisch erstellt.\n\n${path}`);
      } else {
        result = await commitFile(path, md, message, BRANCH);
      }

      // Idempotenz-Key persistieren
      if (idemKey) {
        await putTextBlob(`state/idempotency/${idemKey}.txt`, id, "text/plain");
      }

      // Sofortiger Cache-Update (optional, aber empfohlen)
      await putTextBlob(`raw/tasks/${id}.md`, md, "text/markdown");

      return {
        status: 200,
        jsonBody: {
          ok: true,
          id,
          path,
          commitSha: result.commit.sha,
          htmlUrl: result.content.html_url
        }
      };

    } catch (e) {
      context.error(e);
      return {
        status: 500,
        jsonBody: { ok: false, error: String(e.message || e) }
      };
    }
  }
});
