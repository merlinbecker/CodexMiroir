// HTTP: updateTask
// Aktualisiert einen existierenden Task
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";

app.http("updateTask", {
  methods: ["PUT", "PATCH"],
  route: "tasks/{userId}/{taskId}",
  authLevel: "function",
  handler: async (req, ctx) => {
  ctx.log("=== updateTask START ===");
  try {
    const userId = req.params.userId;
    const taskId = req.params.taskId;
    const updates = await req.json();
    
    ctx.log("Request params:", { userId, taskId, updates });
    
    if (!userId || !taskId) {
      ctx.log("ERROR: Missing required parameters");
      return { 
        status: 400, 
        jsonBody: { error: "Missing parameters. Required: userId, taskId" } 
      };
    }

    ctx.log("Reading existing task...");
    const { tasks } = cosmos();
    const { resource: existingTask } = await tasks.item(taskId, userId).read();
    
    if (!existingTask) {
      ctx.log("ERROR: Task not found");
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

    ctx.log("Updating task document...");
    const { resource } = await tasks.item(taskId, userId).replace(updatedTask);

    ctx.log("Task updated successfully:", resource.id);
    return { status: 200, jsonBody: resource };
  } catch (e) {
    ctx.log.error("=== updateTask ERROR ===");
    ctx.log.error("Error type:", e.constructor.name);
    ctx.log.error("Error message:", e.message);
    ctx.log.error("Error code:", e.code);
    ctx.log.error("Error stack:", e.stack);
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
