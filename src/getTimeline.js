// HTTP: getTimeline
// Gibt die Timeline für einen User zurück (optional mit Datumsbereich)
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("getTimeline", {
  methods: ["GET"],
  route: "api/timeline/{userId}",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const dateFrom = req.query.get("dateFrom");
    const dateTo = req.query.get("dateTo");
    
    const validationError = validateParams({ userId }, ctx);
    if (validationError) return validationError;
    
    const { timeline } = cosmos();
    
    // Query für Timeline-Dokumente
    let query = "SELECT * FROM c WHERE c.userId = @userId AND c.type = 'day'";
    const parameters = [{ name: "@userId", value: userId }];
    
    if (dateFrom) {
      query += " AND c.date >= @dateFrom";
      parameters.push({ name: "@dateFrom", value: dateFrom });
    }
    
    if (dateTo) {
      query += " AND c.date <= @dateTo";
      parameters.push({ name: "@dateTo", value: dateTo });
    }
    
    query += " ORDER BY c.date ASC";

    const { resources } = await timeline.items
      .query({ query, parameters })
      .fetchAll();

    // Alle TaskIDs aus den Timeline-Slots sammeln
    const taskIds = new Set();
    resources.forEach(day => {
      day.slots?.forEach(slot => {
        if (slot.assignment?.taskId) {
          taskIds.add(slot.assignment.taskId);
        }
      });
    });

    // Task-Details laden (nur Titel und ID)
    const taskTitles = new Map();
    if (taskIds.size > 0) {
      const { tasks } = cosmos();
      const taskQuery = {
        query: "SELECT c.id, c.title FROM c WHERE c.userId = @userId AND c.id IN (" + 
               Array.from(taskIds).map((_, i) => `@taskId${i}`).join(", ") + ")",
        parameters: [
          { name: "@userId", value: userId },
          ...Array.from(taskIds).map((taskId, i) => ({ name: `@taskId${i}`, value: taskId }))
        ]
      };

      const { resources: taskData } = await tasks.items
        .query(taskQuery)
        .fetchAll();

      taskData.forEach(task => {
        taskTitles.set(task.id, task.title);
      });
    }

    // Timeline-Daten mit Task-Titeln anreichern (fallback für alte Daten ohne taskTitle)
    const enrichedDays = resources.map(day => ({
      ...day,
      slots: day.slots?.map(slot => ({
        ...slot,
        assignment: slot.assignment?.taskId ? {
          ...slot.assignment,
          // Verwende bereits gespeicherten taskTitle oder lade ihn als Fallback
          taskTitle: slot.assignment.taskTitle || taskTitles.get(slot.assignment.taskId) || 'Task nicht gefunden'
        } : slot.assignment
      }))
    }));

    return { status: 200, jsonBody: { days: enrichedDays } };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
