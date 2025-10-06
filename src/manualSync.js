/*** auch hier: 
 * umbau nach v4
 *
 *
 * 
 */

//function.js

{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"],
      "route": "sync"
    },
    { "type": "http", "direction": "out", "name": "res" }
  ],
  "scriptFile": "../manualSync/index.js"
}



//index.js


// manualSync/index.js
const { fullSync, applyDiff } = require("../shared/sync");

const OWNER = process.env.GITHUB_OWNER;
const REPO  = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(/\/+$/, "");
const TOKEN = process.env.GITHUB_TOKEN;

async function gh(url) {
  const r = await fetch(`https://api.github.com${url}`, {
    headers: { "Authorization": `Bearer ${TOKEN}`, "User-Agent": "codex-miroir", "Accept": "application/vnd.github.v3+json" }
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${url}`);
  return r;
}

async function diffPaths(since, ref) {
  const r = await gh(`/repos/${OWNER}/${REPO}/compare/${since}...${ref}`);
  const data = await r.json();
  const inScope = (p) => p.startsWith(`${BASE}/tasks/`) && p.endsWith(".md");
  const addedOrModified = [];
  const removed = [];
  for (const f of (data.files || [])) {
    const p = f.filename;
    if (!inScope(p)) continue;
    if (f.status === "removed") removed.push(p);
    else addedOrModified.push(p);
  }
  return { addedOrModified, removed };
}

module.exports = async function (context, req) {
  const mode = (req.query.mode || "full").toLowerCase(); // full | diff
  const ref = req.query.ref || BRANCH;
  const since = req.query.since || "";
  const clean = (req.query.clean || "false") === "true";

  try {
    if (mode === "full") {
      const res = await fullSync(ref, clean);
      context.res = { headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, mode, ref, ...res }, null, 2) };
      return;
    }
    if (mode === "diff") {
      if (!since) { context.res = { status: 400, body: "missing ?since=<sha> for diff" }; return; }
      const paths = await diffPaths(since, ref);
      const res = await applyDiff(paths, ref);
      context.res = { headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, mode, ref, since, ...res }, null, 2) };
      return;
    }
    context.res = { status: 400, body: "invalid mode (use full|diff)" };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, body: String(e.message || e) };
  }
};
