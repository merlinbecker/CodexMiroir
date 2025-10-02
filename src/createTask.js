// HTTP: createTask
// Erstellt einen neuen Task im cm_tasks Container
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";

app.http("createTask", {
  methods: ["POST"],
  route: "api/tasks/{userId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  ctx.log("=== createTask START ===");
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { id, kind, title, tags, status } = body || {};
    
    ctx.log("Request params:", { userId, id, kind, title, tags, status });
    
    if (!userId || !kind) {
      ctx.log("ERROR: Missing required parameters");
      return { 
        status: 400, 
        jsonBody: { error: "Missing parameters. Required: kind" } 
      };
    }

    // Generiere UUID wenn keine ID mitgeliefert wurde
    const generateUUID = () => {
      // Verwende Timestamp + Random für extra Eindeutigkeit
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 15);
      const moreParts = Math.random().toString(36).substring(2, 15);
      return `${timestamp}-${randomPart}-${moreParts}`;
    };
    const taskId = id || `task_${generateUUID()}`;

    ctx.log("Initializing Cosmos client...");
    const { tasks } = cosmos();
    ctx.log("Cosmos client initialized");

    // Prüfe ob Task bereits existiert (nur wenn ID mitgeliefert wurde)
    if (id) {
      try {
        const { resource: existingTask } = await tasks.item(id, userId).read();
        if (existingTask) {
          ctx.log("Task already exists:", id);
          return { 
            status: 409, 
            jsonBody: { error: `Task with ID ${id} already exists` } 
          };
        }
      } catch (e) {
        // 404 ist ok - Task existiert noch nicht
        if (e.code !== 404) {
          throw e;
        }
      }
    }

    // Erstelle Task-Dokument
    const task = {
      id: taskId,
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
    const { resource } = await tasks.items.create(task);

    ctx.log("Task created successfully:", resource.id);
    return { status: 201, jsonBody: resource };
  } catch (e) {
    ctx.log("=== createTask ERROR ===");
    ctx.log("Error type:", e.constructor.name);
    ctx.log("Error message:", e.message);
    ctx.log("Error code:", e.code);
    ctx.log("Error stack:", e.stack);
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
