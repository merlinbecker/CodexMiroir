// HTTP: autoFill
// Plant automatisch in den nächsten passenden freien Slot gemäß Regeln
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { ensureDaysUpTo } from "./_ensureDays.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("autoFill", {
  methods: ["POST"],
  route: "api/timeline/{userId}/autofill",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { dateFrom, task } = body || {};
    
    const validationError = validateParams({ 
      userId, 
      dateFrom, 
      task,
      taskId: task?.id,
      taskKind: task?.kind 
    }, ctx);
    if (validationError) return validationError;

    // Berechne einen sinnvollen Suchbereich (z.B. 30 Tage)
    const searchHorizonDays = parseInt(process.env.AUTOFILL_HORIZON || "30", 10);
    const searchUntil = new Date(dateFrom + "T00:00:00Z");
    searchUntil.setUTCDate(searchUntil.getUTCDate() + searchHorizonDays);
    const searchUntilStr = searchUntil.toISOString().slice(0, 10);
    
    // Stelle sicher, dass Days für den Suchbereich existieren
    await ensureDaysUpTo(userId, searchUntilStr, ctx);

    // Verwende Task-Daten direkt aus dem Request
    task._source = "auto";

    const { timeline } = cosmos();
    const sproc = timeline.scripts.storedProcedure("assignTaskToFirstFreeSlot");
    const { resource } = await sproc.execute(userId, [userId, dateFrom, task]);

    return { status: 200, jsonBody: resource };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
