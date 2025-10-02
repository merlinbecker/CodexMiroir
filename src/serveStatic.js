// HTTP: serveStatic
// Serviert die Test-Oberfläche
import { app } from "@azure/functions";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.http("serveStatic", {
  methods: ["GET"],
  route: "{*path}",
  authLevel: "anonymous",
  handler: async (req, ctx) => {
    try {
      let filePath = req.params.path || "index.html";
      
      // Sicherheit: Nur Dateien aus public/
      if (filePath.includes("..")) {
        return { status: 403, body: "Forbidden" };
      }
      
      // Default zu index.html
      if (filePath === "" || filePath === "/") {
        filePath = "index.html";
      }
      
      const fullPath = path.join(path.dirname(__dirname), "public", filePath);
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        
        // Content-Type ermitteln
        const contentType = 
          filePath.endsWith(".html") ? "text/html" :
          filePath.endsWith(".css") ? "text/css" :
          filePath.endsWith(".js") ? "application/javascript" :
          "text/plain";
        
        return {
          status: 200,
          headers: { "Content-Type": contentType },
          body: content
        };
      } catch (e) {
        if (e.code === "ENOENT") {
          return { status: 404, body: "Not Found" };
        }
        throw e;
      }
    } catch (e) {
      ctx.log.error("serveStatic error:", e);
      return { status: 500, body: "Internal Server Error" };
    }
  }
});
