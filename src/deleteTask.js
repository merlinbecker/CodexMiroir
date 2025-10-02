// HTTP: deleteTask
// Löscht einen Task aus der Datenbank
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";

app.http("deleteTask", {
  methods: ["DELETE"],
  route: "api/tasks/{userId}/{taskId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  ctx.log("=== deleteTask START ===");
  try {
    const userId = req.params.userId;
    const taskId = req.params.taskId;
    
    ctx.log("Request params:", { userId, taskId });
    
    if (!userId || !taskId) {
      ctx.log("ERROR: Missing required parameters");
      return { 
        status: 400, 
        jsonBody: { error: "Missing parameters. Required: userId, taskId" } 
      };
    }

    ctx.log("Deleting task...");
    const { tasks } = cosmos();
    await tasks.item(taskId, userId).delete();

    ctx.log("Task deleted successfully:", taskId);
    return { status: 200, jsonBody: { message: "Task deleted successfully", taskId } };
  } catch (e) {
    ctx.log("=== deleteTask ERROR ===");
    ctx.log("Error type:", e.constructor.name);
    ctx.log("Error message:", e.message);
    ctx.log("Error code:", e.code);
    ctx.log("Error stack:", e.stack);
    return { 
      status: e.code === 404 ? 404 : 500, 
      jsonBody: { 
        error: String(e.message || e),
        errorType: e.constructor.name,
        errorCode: e.code
      } 
    };
  }
}});
