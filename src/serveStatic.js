// HTTP: serveStatic
// Serviert die Test-Oberfläche
import { app } from "@azure/functions";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getContentType } from "./_helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.http("serveStatic", {
  methods: ["GET"],
  route: "{*path}",
  authLevel: "anonymous",
  handler: async (req, ctx) => {
    try {
      // Normalize path
      let requestPath = req.params.path || "";
      ctx.log('[serveStatic] Raw path:', requestPath);
      
      // Skip API routes - let them be handled by their specific functions
      if (requestPath.startsWith('codex') || requestPath.startsWith('sync') || requestPath.startsWith('github')) {
        ctx.log('[serveStatic] Skipping API route:', requestPath);
        return { status: 404, body: "Not Found - Use API endpoint" };
      }
      
      if (!requestPath || requestPath === "/") {
        requestPath = "index.html";
      }
      ctx.log('[serveStatic] Normalized path:', requestPath);

      // Security: Block path traversal
      if (requestPath.includes("..")) {
        return { status: 403, body: "Forbidden" };
      }

      const fullPath = path.join(path.dirname(__dirname), "public", requestPath);
      ctx.log('[serveStatic] Attempting to read file:', fullPath);

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        ctx.log('[serveStatic] Successfully read file:', fullPath);

        return {
          status: 200,
          headers: { "Content-Type": getContentType(requestPath) },
          body: content
        };
      } catch (e) {
        if (e.code === "ENOENT") {
          ctx.log('[serveStatic] File not found:', fullPath);
          return { status: 404, body: "Not Found" };
        }
        ctx.log('[serveStatic] Error reading file:', fullPath, e);
        throw e;
      }
    } catch (e) {
      ctx.log("serveStatic error:", e);
      return { status: 500, body: "Internal Server Error" };
    }
  }
});