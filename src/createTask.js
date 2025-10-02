// HTTP: createTask
// Erstellt einen neuen Task im cm_tasks Container
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { errorResponse, validateParams, generateTaskId } from "./_helpers.js";

app.http("createTask", {
  methods: ["POST"],
  route: "api/tasks/{userId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { id, kind, title, tags, status } = body || {};
    
    const validationError = validateParams({ userId, kind }, ctx);
    if (validationError) return validationError;

    const taskId = id || generateTaskId();
    const { tasks } = cosmos();

    // Prüfe ob Task bereits existiert (nur wenn ID mitgeliefert wurde)
    if (id) {
      try {
        const { resource: existingTask } = await tasks.item(id, userId).read();
        if (existingTask) {
          return { 
            status: 409, 
            jsonBody: { error: `Task with ID ${id} already exists` } 
          };
        }
      } catch (e) {
        // 404 ist ok - Task existiert noch nicht
        if (e.code !== 404) throw e;
      }
    }

    // Erstelle Task-Dokument
    const task = {
      id: taskId,
      type: "task",
      userId,
      kind,
      title: title || "",
      tags: tags || [],
      status: status || "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { resource } = await tasks.items.create(task);
    return { status: 201, jsonBody: resource };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
