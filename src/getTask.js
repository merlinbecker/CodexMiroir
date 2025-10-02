// HTTP: getTask
// Holt einen einzelnen Task
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";

app.http("getTask", {
  methods: ["GET"],
  route: "tasks/{userId}/{taskId}",
  authLevel: "function",
  handler: async (req, ctx) => {
  ctx.log("=== getTask START ===");
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

    ctx.log("Reading task...");
    const { tasks } = cosmos();
    const { resource } = await tasks.item(taskId, userId).read();
    
    if (!resource) {
      ctx.log("ERROR: Task not found");
      return { 
        status: 404, 
        jsonBody: { error: "Task not found" } 
      };
    }

    ctx.log("Task retrieved successfully:", resource.id);
    return { status: 200, jsonBody: resource };
  } catch (e) {
    ctx.log("=== getTask ERROR ===");
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
