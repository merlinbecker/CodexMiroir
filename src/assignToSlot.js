// HTTP: assignToSlot
// Setzt einen Task manuell in einen Slot und nutzt die Stored Procedure assignTaskToSpecificSlot
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { ensureDaysUpTo } from "./_ensureDays.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("assignToSlot", {
  methods: ["POST"],
  route: "api/timeline/{userId}/assign",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { date, slotIdx, task, source } = body || {};
    
    const validationError = validateParams({ 
      userId, 
      date, 
      slotIdx, 
      task, 
      taskId: task?.id 
    }, ctx);
    if (validationError) return validationError;

    // Stelle sicher, dass Days bis zu diesem Datum existieren
    await ensureDaysUpTo(userId, date, ctx);

    // Verwende Task-Daten direkt aus dem Request (bei frisch erstellten Tasks)
    // Kennzeichne Quelle für SP-Regelprüfung
    task._source = source === "auto" ? "auto" : "manual";

    // Debug: Log wichtige Werte
    ctx.log(`DEBUG: Task ${task.id}, kind: ${task.kind}, fixed: ${task.fixed}, source: ${task._source}, date: ${date}`);

    const { timeline } = cosmos();
    const sproc = timeline.scripts.storedProcedure("assignTaskToSpecificSlot");
    const { resource } = await sproc.execute(userId, [userId, date, slotIdx, task]);

    return { status: 200, jsonBody: resource };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
