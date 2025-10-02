// HTTP: createTask
// Erstellt einen neuen Task im cm_tasks Container
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("createTask", {
  methods: ["POST"],
  route: "api/tasks/{userId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { kind, title, tags, status } = body || {};
    
    ctx.log(`DEBUG createTask: userId=${userId}, kind=${kind}, title=${title}`);
    
    const validationError = validateParams({ userId, kind }, ctx);
    if (validationError) return validationError;

    const { tasks } = cosmos();

    // Erstelle Task-Dokument OHNE ID - Cosmos DB vergibt automatisch eine
    const { id, ...bodyWithoutId } = body || {}; // Entferne explizit das id-Feld
    const task = {
      type: "task",
      userId,
      kind,
      title: title || "",
      tags: tags || [],
      status: status || "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...bodyWithoutId // Andere Felder, aber OHNE id
    };

    ctx.log(`DEBUG createTask: Creating task without ID`, task);
    
    const { resource } = await tasks.items.create(task);
    
    ctx.log(`DEBUG createTask: Created task with ID=${resource.id}`);
    
    return { status: 201, jsonBody: resource };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
