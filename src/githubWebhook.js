const { app } = require("@azure/functions");
const crypto = require("crypto");
const { applyDiff } = require("../shared/sync");

const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(/\/+$/, "");
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

function verifySignature(request) {
  const sig = request.headers.get("x-hub-signature-256");
  if (!sig || !sig.startsWith("sha256=")) return false;
  const mac = crypto.createHmac("sha256", SECRET);
  mac.update(request.body || "");
  const digest = `sha256=${mac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  } catch {
    return false;
  }
}

app.http("githubWebhook", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "github/webhook",
  handler: async (request, context) => {
    if (!verifySignature(request)) {
      return { status: 401, body: "invalid signature" };
    }

    if (request.headers.get("x-github-event") !== "push") {
      return { status: 202, body: "ignored" };
    }

    const payload = await request.json();
    const head = payload.after;

    const addedOrModified = [];
    const removed = [];

    for (const c of payload.commits || []) {
      for (const p of c.added || []) {
        if (p.startsWith(`${BASE}/tasks/`) && p.endsWith(".md")) {
          addedOrModified.push(p);
        }
      }
      for (const p of c.modified || []) {
        if (p.startsWith(`${BASE}/tasks/`) && p.endsWith(".md")) {
          addedOrModified.push(p);
        }
      }
      for (const p of c.removed || []) {
        if (p.startsWith(`${BASE}/tasks/`) && p.endsWith(".md")) {
          removed.push(p);
        }
      }
    }

    const res = await applyDiff({ addedOrModified, removed }, head);

    return {
      status: 200,
      headers: { "content-type": "application/json" },
      jsonBody: { ok: true, head, ...res }
    };
  }
});