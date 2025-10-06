/*** 
 * diesen code habe ich kopiert . bringe ihn in die v4 form der azure functions  
 *
 * 
 *
 */

//function.json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post"],
      "route": "github/webhook"
    },
    { "type": "http", "direction": "out", "name": "res" }
  ],
  "scriptFile": "../githubWebhook/index.js"
}



//index.js
const crypto = require("crypto");
const { putTextBlob, deleteBlob } = require("../shared/storage");

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(/\/+$/, "");
const TOKEN = process.env.GITHUB_TOKEN;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

function verifySignature(req) {
  const sig = req.headers["x-hub-signature-256"];
  if (!sig || !sig.startsWith("sha256=")) return false;
  const mac = crypto.createHmac("sha256", SECRET);
  mac.update(req.rawBody || "");
  const digest = `sha256=${mac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  } catch {
    return false;
  }
}

async function fetchFileAtSha(path, sha) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${sha}`;
  const r = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "User-Agent": "codex-miroir",
      "Accept": "application/vnd.github.v3+json"
    }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} for ${path}`);
  const j = await r.json();
  if (j.type !== "file") return null;
  if (j.encoding === "base64" && j.content) {
    const buf = Buffer.from(j.content, "base64");
    return buf.toString("utf8");
  }
  // Fallback raw
  const raw = await fetch(j.download_url, { headers: { "Authorization": `Bearer ${TOKEN}` } });
  return await raw.text();
}

function toBlobPath(repoPath) {
  // repoPath e.g. codex-miroir/tasks/2025-10-06_meeting.md
  return `raw/${repoPath.replace(`${BASE}/`, "")}`;
}

module.exports = async function (context, req) {
  if (!verifySignature(req)) {
    context.res = { status: 401, body: "invalid signature" };
    return;
  }
  const event = req.headers["x-github-event"];
  if (event !== "push") {
    context.res = { status: 202, body: "ignored" };
    return;
  }

  const payload = req.body || {};
  const headSha = payload.after;

  const touched = new Set();
  for (const c of payload.commits || []) {
    for (const p of [...c.added, ...c.modified, ...c.removed]) {
      if (p && (p.startsWith(`${BASE}/tasks/`) || p.startsWith(`${BASE}/timeline/`)) && p.endsWith(".md")) {
        touched.add(p);
      }
    }
  }

  let changed = 0, removed = 0, skipped = 0;
  for (const p of touched) {
    // removed?
    const wasRemoved = (payload.commits || []).some(c => (c.removed || []).includes(p));
    if (wasRemoved) {
      await deleteBlob(toBlobPath(p));
      removed++;
      continue;
    }
    // pull fresh content at head SHA
    const text = await fetchFileAtSha(p, headSha);
    if (text == null) { skipped++; continue; }
    await putTextBlob(toBlobPath(p), text, "text/markdown");
    changed++;
  }

  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true, head: headSha, changed, removed, skipped }, null, 2)
  };
};