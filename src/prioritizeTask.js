// HTTP: prioritizeTask
// Tauscht einen Task mit dem höchstpriorisierten Task in der Timeline
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";

app.http("prioritizeTask", {
  methods: ["POST"],
  route: "timeline/{userId}/prioritize",
  authLevel: "function",
  handler: async (req, ctx) => {
  ctx.log("=== prioritizeTask START ===");
  try {
    const userId = req.params.userId;
    const body = await req.json();
    const { taskId } = body || {};
    
    ctx.log("Request params:", { userId, taskId });
    
    if (!userId || !taskId) {
      ctx.log("ERROR: Missing required parameters");
      return { 
        status: 400, 
        jsonBody: { error: "Missing parameters. Required: taskId" } 
      };
    }

    const { timeline } = cosmos();
    
    // 1. Finde den Task in der Timeline
    ctx.log("Searching for task in timeline...");
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
      ctx.log("ERROR: Task not found in timeline");
      return { 
        status: 404, 
        jsonBody: { error: "Task not found in timeline" } 
      };
    }
    
    const currentDay = currentDays[0];
    const currentSlot = currentDay.slots.find(s => s.assignment.taskId === taskId);
    
    ctx.log("Task found in day:", currentDay.date, "slot:", currentSlot.idx);
    
    // 2. Finde den ersten zugewiesenen Task in der Timeline (höchste Priorität)
    ctx.log("Searching for first assigned task...");
    const firstQuery = {
      query: `SELECT * FROM c WHERE c.type = 'day' AND c.userId = @userId 
              AND ARRAY_LENGTH(ARRAY(SELECT VALUE s FROM s IN c.slots WHERE s.assignment.taskId != null)) > 0 
              ORDER BY c.date ASC`,
      parameters: [{ name: "@userId", value: userId }]
    };
    
    const { resources: firstDays } = await timeline.items.query(firstQuery).fetchAll();
    
    if (firstDays.length === 0) {
      ctx.log("ERROR: No assigned tasks in timeline");
      return { 
        status: 404, 
        jsonBody: { error: "No assigned tasks found in timeline" } 
      };
    }
    
    const firstDay = firstDays[0];
    const firstSlot = firstDay.slots.find(s => s.assignment.taskId !== null);
    
    ctx.log("First task found in day:", firstDay.date, "slot:", firstSlot.idx, "taskId:", firstSlot.assignment.taskId);
    
    // Wenn es derselbe Task ist, nichts zu tun
    if (firstSlot.assignment.taskId === taskId) {
      ctx.log("Task is already the highest priority");
      return { 
        status: 200, 
        jsonBody: { message: "Task is already at highest priority", swapped: false } 
      };
    }
    
    // 3. Tausche die Assignments
    ctx.log("Swapping assignments...");
    const tempAssignment = { ...currentSlot.assignment };
    currentSlot.assignment = { ...firstSlot.assignment };
    firstSlot.assignment = tempAssignment;
    
    // 4. Speichere beide Tage
    ctx.log("Saving updated days...");
    await timeline.item(currentDay.id, userId).replace(currentDay);
    
    // Nur speichern, wenn es ein anderer Tag ist
    if (firstDay.id !== currentDay.id) {
      await timeline.item(firstDay.id, userId).replace(firstDay);
    }
    
    ctx.log("Tasks swapped successfully");
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
    ctx.log.error("=== prioritizeTask ERROR ===");
    ctx.log.error("Error type:", e.constructor.name);
    ctx.log.error("Error message:", e.message);
    ctx.log.error("Error code:", e.code);
    ctx.log.error("Error stack:", e.stack);
    return { 
      status: 500, 
      jsonBody: { 
        error: String(e.message || e),
        errorType: e.constructor.name,
        errorCode: e.code
      } 
    };
  }
}});
