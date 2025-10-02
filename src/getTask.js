// HTTP: getTask
// Holt einen einzelnen Task
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("getTask", {
  methods: ["GET"],
  route: "api/tasks/{userId}/{taskId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const taskId = req.params.taskId;
    
    const validationError = validateParams({ userId, taskId }, ctx);
    if (validationError) return validationError;

    const { tasks } = cosmos();
    const { resource } = await tasks.item(taskId, userId).read();
    
    if (!resource) {
      return { 
        status: 404, 
        jsonBody: { error: "Task not found" } 
      };
    }

    return { status: 200, jsonBody: resource };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
