import { app } from "@azure/functions";
import crypto from "crypto";
import { applyDiff } from "../shared/sync.js";
import { invalidateCacheForUser } from "../shared/storage.js";

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

function extractUserIdFromPath(path) {
  // Path format: "codex-miroir/userId/tasks/0042-Title.md"
  // Extract userId from path
  const match = path.match(/^[^/]+\/([^/]+)\/tasks\//);
  return match ? match[1] : null;
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

      // Validate content type
      const contentType = request.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        context.log("[Webhook] Invalid content-type:", contentType);
        return { 
          status: 400, 
          body: "Expected application/json content-type" 
        };
      }

      // Check event type
      const eventType = request.headers.get("x-github-event");
      context.log("[Webhook] Event type:", eventType);
      
      if (eventType !== "push") {
        return { status: 202, body: "ignored" };
      }

      // Parse JSON from text
      let payload;
      try {
        payload = JSON.parse(bodyText);
      } catch (parseError) {
        context.log("[Webhook] Failed to parse JSON, body starts with:", bodyText.substring(0, 50));
        return { 
          status: 400, 
          body: "Invalid JSON payload" 
        };
      }
      
      const head = payload.after;
      context.log("[Webhook] Processing push to:", head);

      // Gruppiere Änderungen nach userId
      const changesByUser = new Map();

      for (const c of payload.commits || []) {
        for (const p of c.added || []) {
          // Match pattern: codex-miroir/userId/tasks/NNNN-Title.md
          if (p.startsWith(`${BASE}/`) && p.match(/\/tasks\/\d{4}-[^/]+\.md$/)) {
            const userId = extractUserIdFromPath(p);
            if (!userId) {
              context.log("[Webhook] WARNING: Could not extract userId from path:", p);
              continue;
            }
            
            if (!changesByUser.has(userId)) {
              changesByUser.set(userId, { addedOrModified: [], removed: [] });
            }
            changesByUser.get(userId).addedOrModified.push(p);
          }
        }
        for (const p of c.modified || []) {
          if (p.startsWith(`${BASE}/`) && p.match(/\/tasks\/\d{4}-[^/]+\.md$/)) {
            const userId = extractUserIdFromPath(p);
            if (!userId) {
              context.log("[Webhook] WARNING: Could not extract userId from path:", p);
              continue;
            }
            
            if (!changesByUser.has(userId)) {
              changesByUser.set(userId, { addedOrModified: [], removed: [] });
            }
            changesByUser.get(userId).addedOrModified.push(p);
          }
        }
        for (const p of c.removed || []) {
          if (p.startsWith(`${BASE}/`) && p.match(/\/tasks\/\d{4}-[^/]+\.md$/)) {
            const userId = extractUserIdFromPath(p);
            if (!userId) {
              context.log("[Webhook] WARNING: Could not extract userId from path:", p);
              continue;
            }
            
            if (!changesByUser.has(userId)) {
              changesByUser.set(userId, { addedOrModified: [], removed: [] });
            }
            changesByUser.get(userId).removed.push(p);
          }
        }
      }

      context.log(`[Webhook] Processing changes for ${changesByUser.size} user(s)`);

      // Verarbeite Änderungen pro User
      const results = [];
      for (const [userId, changes] of changesByUser) {
        context.log(`[Webhook] User ${userId}: ${changes.addedOrModified.length} added/modified, ${changes.removed.length} removed`);
        
        // Sync Storage für diesen User
        const res = await applyDiff(changes, head, userId);
        
        // Invalidiere NUR diesen User-Cache
        const cacheInvalidation = await invalidateCacheForUser(userId);
        context.log(`[Webhook] Cache invalidated for user ${userId}: ${JSON.stringify(cacheInvalidation)}`);
        
        results.push({ 
          userId, 
          filesChanged: changes.addedOrModified.length + changes.removed.length,
          cacheInvalidation,
          ...res 
        });
      }
      
      context.log("[Webhook] Sync completed successfully for all users");

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        jsonBody: { 
          ok: true, 
          head, 
          usersAffected: results.length,
          results 
        }
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