// HTTP: updateTask
// Aktualisiert einen existierenden Task
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("updateTask", {
  methods: ["PUT", "PATCH"],
  route: "api/tasks/{userId}/{taskId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const taskId = req.params.taskId;
    const updates = await req.json();
    
    const validationError = validateParams({ userId, taskId }, ctx);
    if (validationError) return validationError;

    const { tasks } = cosmos();
    const { resource: existingTask } = await tasks.item(taskId, userId).read();
    
    if (!existingTask) {
      return { 
        status: 404, 
        jsonBody: { error: "Task not found" } 
      };
    }

    // Merge updates with existing task
    const updatedTask = {
      ...existingTask,
      ...updates,
      id: taskId, // ID kann nicht geändert werden
      type: "task", // Type kann nicht geändert werden
      userId, // userId kann nicht geändert werden
      updatedAt: new Date().toISOString()
    };

    const { resource } = await tasks.item(taskId, userId).replace(updatedTask);
    return { status: 200, jsonBody: resource };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
