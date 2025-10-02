// HTTP: assignToSlot
// Setzt einen Task manuell in einen Slot und nutzt die Stored Procedure assignTaskToSpecificSlot
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { ensureDaysUpTo } from "./_ensureDays.js";

app.http("assignToSlot", {
  methods: ["POST"],
  route: "timeline/{userId}/assign",
  authLevel: "function",
  handler: async (req, ctx) => {
  ctx.log("=== assignToSlot START ===");
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { date, slotIdx, task, source } = body || {};
    
    ctx.log("Request params:", { userId, date, slotIdx, taskId: task?.id, source });
    
    if (!userId || !date || typeof slotIdx !== "number" || !task || !task.id) {
      ctx.log("ERROR: Missing required parameters");
      return { 
        status: 400, 
        jsonBody: { error: "Missing parameters. Required: date, slotIdx, task, task.id" } 
      };
    }

    // Stelle sicher, dass Days bis zu diesem Datum existieren
    ctx.log("Ensuring days up to:", date);
    await ensureDaysUpTo(userId, date, ctx);
    ctx.log("Days ensured");

    // Kennzeichne Quelle für SP-Regelprüfung
    task._source = source === "auto" ? "auto" : "manual";

    ctx.log("Initializing Cosmos and executing stored procedure...");
    const { timeline } = cosmos();
    const sproc = timeline.scripts.storedProcedure("assignTaskToSpecificSlot");
    const { resource } = await sproc.execute(userId, [userId, date, slotIdx, task]);

    ctx.log("Assignment successful");
    return { status: 200, jsonBody: resource };
  } catch (e) {
    ctx.log.error("=== assignToSlot ERROR ===");
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
