// HTTP: prioritizeTask
// Tauscht einen Task mit dem höchstpriorisierten Task in der Timeline
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";
import { errorResponse, validateParams } from "./_helpers.js";

app.http("prioritizeTask", {
  methods: ["POST"],
  route: "api/timeline/{userId}/prioritize",
  authLevel: "admin",
  handler: async (req, ctx) => {
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { taskId } = body || {};
    
    const validationError = validateParams({ userId, taskId }, ctx);
    if (validationError) return validationError;

    const { timeline } = cosmos();
    
    // 1. Finde den Task in der Timeline
    const findQuery = {
      query: `SELECT * FROM c WHERE c.type = 'day' AND c.userId = @userId 
              AND ARRAY_LENGTH(ARRAY(SELECT VALUE s FROM s IN c.slots WHERE s.assignment.taskId = @taskId)) > 0 
              ORDER BY c.date ASC`,
      parameters: [
        { name: "@userId", value: userId },
        { name: "@taskId", value: taskId }
      ]
    };
    
    const { resources: currentDays } = await timeline.items.query(findQuery).fetchAll();
    
    if (currentDays.length === 0) {
      return { 
        status: 404, 
        jsonBody: { error: "Task not found in timeline" } 
      };
    }
    
    const currentDay = currentDays[0];
    const currentSlot = currentDay.slots.find(s => s.assignment.taskId === taskId);
    
    // 2. Finde den ersten zugewiesenen Task in der Timeline (höchste Priorität)
    const firstQuery = {
      query: `SELECT * FROM c WHERE c.type = 'day' AND c.userId = @userId 
              AND ARRAY_LENGTH(ARRAY(SELECT VALUE s FROM s IN c.slots WHERE s.assignment.taskId != null)) > 0 
              ORDER BY c.date ASC`,
      parameters: [{ name: "@userId", value: userId }]
    };
    
    const { resources: firstDays } = await timeline.items.query(firstQuery).fetchAll();
    
    if (firstDays.length === 0) {
      return { 
        status: 404, 
        jsonBody: { error: "No assigned tasks found in timeline" } 
      };
    }
    
    const firstDay = firstDays[0];
    const firstSlot = firstDay.slots.find(s => s.assignment.taskId !== null);
    
    // Wenn es derselbe Task ist, nichts zu tun
    if (firstSlot.assignment.taskId === taskId) {
      return { 
        status: 200, 
        jsonBody: { message: "Task is already at highest priority", swapped: false } 
      };
    }
    
    // 3. Tausche die Assignments
    const tempAssignment = { ...currentSlot.assignment };
    currentSlot.assignment = { ...firstSlot.assignment };
    firstSlot.assignment = tempAssignment;
    
    // 4. Speichere beide Tage
    await timeline.item(currentDay.id, userId).replace(currentDay);
    
    // Nur speichern, wenn es ein anderer Tag ist
    if (firstDay.id !== currentDay.id) {
      await timeline.item(firstDay.id, userId).replace(firstDay);
    }
    
    return { 
      status: 200, 
      jsonBody: { 
        message: "Task prioritized successfully",
        swapped: true,
        from: { date: currentDay.date, slotIdx: currentSlot.idx },
        to: { date: firstDay.date, slotIdx: firstSlot.idx }
      } 
    };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
