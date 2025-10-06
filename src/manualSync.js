
import { app } from "@azure/functions";
import { fullSync, applyDiff } from "../shared/sync.js";

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(/\/+$/, "");
const TOKEN = process.env.GITHUB_TOKEN;

async function gh(url) {
  const r = await fetch(`https://api.github.com${url}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "codex-miroir",
      Accept: "application/vnd.github.v3+json",
    },
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
  for (const f of data.files || []) {
    const p = f.filename;
    if (!inScope(p)) continue;
    if (f.status === "removed") removed.push(p);
    else addedOrModified.push(p);
  }
  return { addedOrModified, removed };
}

app.http("manualSync", {
  methods: ["GET", "POST"],
  authLevel: "function",
  route: "sync",
  handler: async (request, context) => {
    const url = new URL(request.url);
    const mode = (url.searchParams.get("mode") || "full").toLowerCase();
    const ref = url.searchParams.get("ref") || BRANCH;
    const since = url.searchParams.get("since") || "";
    const clean = url.searchParams.get("clean") === "true";

    try {
      if (mode === "full") {
        const res = await fullSync(ref, clean);
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          jsonBody: { ok: true, mode, ref, ...res },
        };
      }

      if (mode === "diff") {
        if (!since) {
          return {
            status: 400,
            body: "missing ?since=<sha> for diff",
          };
        }
        const paths = await diffPaths(since, ref);
        const res = await applyDiff(paths, ref);
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          jsonBody: { ok: true, mode, ref, since, ...res },
        };
      }

      return {
        status: 400,
        body: "invalid mode (use full|diff)",
      };
    } catch (e) {
      context.error(e);
      return {
        status: 500,
        body: String(e.message || e),
      };
    }
  },
});
