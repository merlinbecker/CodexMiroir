// HTTP: deleteTask
// Löscht einen Task aus der Datenbank
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("deleteTask", {
  methods: ["DELETE"],
  route: "api/tasks/{userId}/{taskId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const taskId = req.params.taskId;
    
    const validationError = validateParams({ userId, taskId }, ctx);
    if (validationError) return validationError;

    const { tasks } = cosmos();
    await tasks.item(taskId, userId).delete();

    return { status: 200, jsonBody: { message: "Task deleted successfully", taskId } };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
