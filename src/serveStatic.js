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
      // Normalize path and default to index.html
      let filePath = req.params.path || "index.html";
      if (filePath === "" || filePath === "/") {
        filePath = "index.html";
      }
      
      // Security: Block path traversal
      if (filePath.includes("..")) {
        return { status: 403, body: "Forbidden" };
      }
      
      const fullPath = path.join(path.dirname(__dirname), "public", filePath);
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        
        return {
          status: 200,
          headers: { "Content-Type": getContentType(filePath) },
          body: content
        };
      } catch (e) {
        if (e.code === "ENOENT") {
          return { status: 404, body: "Not Found" };
        }
        throw e;
      }
    } catch (e) {
      ctx.log("serveStatic error:", e);
      return { status: 500, body: "Internal Server Error" };
    }
  }
});
