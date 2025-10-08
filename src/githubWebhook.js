import { app } from "@azure/functions";
import crypto from "crypto";
import { applyDiff } from "../shared/sync.js";

const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(/\/+$/, "");
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

function verifySignature(body, signature) {
  if (!signature || !signature.startsWith("sha256=")) return false;
  
  // Ensure body is a string or buffer (defensive check)
  if (typeof body !== 'string' && !Buffer.isBuffer(body)) {
    throw new TypeError(`verifySignature expects string or Buffer, got ${typeof body}`);
  }
  
  const mac = crypto.createHmac("sha256", SECRET);
  mac.update(body || "");
  const digest = `sha256=${mac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

app.http("githubWebhook", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "github/webhook",
  handler: async (request, context) => {
    try {
      context.log("[Webhook] Received request");
      
      // Read body as text first (can only read once)
      // Note: request.text() returns a Promise<string>, not a ReadableStream
      const bodyText = await request.text();
      
      // Ensure we have a string (defensive programming)
      if (typeof bodyText !== 'string') {
        context.log("[Webhook] Error: bodyText is not a string, got:", typeof bodyText);
        return { status: 400, body: "Invalid request body type" };
      }
      
      context.log("[Webhook] Body length:", bodyText.length);
      
      // Verify signature
      const signature = request.headers.get("x-hub-signature-256");
      context.log("[Webhook] Signature present:", !!signature);
      
      if (!verifySignature(bodyText, signature)) {
        context.log("[Webhook] Signature verification failed");
        return { status: 401, body: "invalid signature" };
      }
      
      context.log("[Webhook] Signature verified");

      // Check event type
      const eventType = request.headers.get("x-github-event");
      context.log("[Webhook] Event type:", eventType);
      
      if (eventType !== "push") {
        return { status: 202, body: "ignored" };
      }

      // Parse JSON from text
      const payload = JSON.parse(bodyText);
      const head = payload.after;
      context.log("[Webhook] Processing push to:", head);

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

      context.log("[Webhook] Files to sync - added/modified:", addedOrModified.length, "removed:", removed.length);

      const res = await applyDiff({ addedOrModified, removed }, head);
      
      context.log("[Webhook] Sync completed successfully:", res);

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        jsonBody: { ok: true, head, ...res }
      };
    } catch (error) {
      context.log("[Webhook] Error:", error.message);
      context.log("[Webhook] Stack:", error.stack);
      return {
        status: 500,
        body: `Webhook error: ${error.message}`
      };
    }
  }
});