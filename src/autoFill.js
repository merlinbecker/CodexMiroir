// HTTP: autoFill
// Plant automatisch in den nächsten passenden freien Slot gemäß Regeln
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { ensureDaysUpTo } from "./_ensureDays.js";

app.http("autoFill", {
  methods: ["POST"],
  route: "api/timeline/{userId}/autofill",
  authLevel: "admin",
  handler: async (req, ctx) => {
  ctx.log("=== autoFill START ===");
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { dateFrom, task } = body || {};
    
    ctx.log("Request params:", { userId, dateFrom, taskId: task?.id, taskKind: task?.kind });
    
    if (!userId || !dateFrom || !task || !task.id || !task.kind) {
      ctx.log("ERROR: Missing required parameters");
      return { 
        status: 400, 
        jsonBody: { error: "Missing parameters. Required: dateFrom, task, task.id, task.kind" } 
      };
    }

    // Berechne einen sinnvollen Suchbereich (z.B. 30 Tage)
    const searchHorizonDays = parseInt(process.env.AUTOFILL_HORIZON || "30", 10);
    const searchUntil = new Date(dateFrom + "T00:00:00Z");
    searchUntil.setUTCDate(searchUntil.getUTCDate() + searchHorizonDays);
    const searchUntilStr = searchUntil.toISOString().slice(0, 10);
    
    ctx.log("Search horizon:", searchHorizonDays, "days until:", searchUntilStr);
    
    // Stelle sicher, dass Days für den Suchbereich existieren
    ctx.log("Ensuring days up to:", searchUntilStr);
    await ensureDaysUpTo(userId, searchUntilStr, ctx);
    ctx.log("Days ensured");

    task._source = "auto";

    ctx.log("Initializing Cosmos and executing stored procedure...");
    const { timeline } = cosmos();
    const sproc = timeline.scripts.storedProcedure("assignTaskToFirstFreeSlot");
    const { resource } = await sproc.execute(userId, [userId, dateFrom, task]);

    ctx.log("AutoFill successful");
    return { status: 200, jsonBody: resource };
  } catch (e) {
    ctx.log("=== autoFill ERROR ===");
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
