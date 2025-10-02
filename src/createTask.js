// HTTP: createTask
// Erstellt einen neuen Task im cm_tasks Container
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";

app.http("createTask", {
  methods: ["POST"],
  route: "tasks/{userId}",
  authLevel: "function",
  handler: async (req, ctx) => {
  ctx.log("=== createTask START ===");
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { id, kind, title, tags, status } = body || {};
    
    ctx.log("Request params:", { userId, id, kind, title, tags, status });
    
    if (!userId || !id || !kind) {
      ctx.log("ERROR: Missing required parameters");
      return { 
        status: 400, 
        jsonBody: { error: "Missing parameters. Required: id, kind" } 
      };
    }

    // Erstelle Task-Dokument
    const task = {
      id,
      type: "task",
      userId,
      kind, // business oder personal
      title: title || "",
      tags: tags || [],
      status: status || "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    ctx.log("Creating task document...");
    const { tasks } = cosmos();
    const { resource } = await tasks.items.create(task);

    ctx.log("Task created successfully:", resource.id);
    return { status: 201, jsonBody: resource };
  } catch (e) {
    ctx.log.error("=== createTask ERROR ===");
    ctx.log.error("Error type:", e.constructor.name);
    ctx.log.error("Error message:", e.message);
    ctx.log.error("Error code:", e.code);
    ctx.log.error("Error stack:", e.stack);
    return { 
      status: e.code === 409 ? 409 : 500, 
      jsonBody: { 
        error: String(e.message || e),
        errorType: e.constructor.name,
        errorCode: e.code
      } 
    };
  }
}});
