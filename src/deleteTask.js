// HTTP: deleteTask
// Löscht einen Task aus der Datenbank und entfernt alle Timeline-Referenzen
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

    const { tasks, timeline } = cosmos();
    
    // 1. Task aus der Tasks-Sammlung löschen
    await tasks.item(taskId, userId).delete();
    
    // 2. Alle Timeline-Referenzen auf diesen Task entfernen
    const timelineQuery = {
      query: "SELECT * FROM c WHERE c.userId = @userId AND c.type = 'day'",
      parameters: [{ name: "@userId", value: userId }]
    };
    
    const { resources: timelineDays } = await timeline.items
      .query(timelineQuery)
      .fetchAll();
    
    // Durch alle Timeline-Tage iterieren und Task-Referenzen entfernen
    for (const day of timelineDays) {
      let needsUpdate = false;
      
      // Durch alle Slots des Tages iterieren
      for (const slot of day.slots || []) {
        if (slot.assignment && slot.assignment.taskId === taskId) {
          // Task-Referenz entfernen
          slot.assignment = {
            taskId: null,
            kind: null,
            source: null,
            taskTitle: null
          };
          needsUpdate = true;
        }
      }
      
      // Timeline-Tag aktualisieren, falls Änderungen vorgenommen wurden
      if (needsUpdate) {
        await timeline.item(day.id, userId).replace(day);
      }
    }

    return { status: 200, jsonBody: { message: "Task deleted successfully", taskId } };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
