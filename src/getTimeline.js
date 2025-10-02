// HTTP: getTimeline
// Gibt die Timeline für einen User zurück (optional mit Datumsbereich)
import { app } from "@azure/functions";
import { cosmos } from "./_cosmos.js";

app.http("getTimeline", {
  methods: ["GET"],
  route: "timeline/{userId}",
  authLevel: "function",
  handler: async (req, ctx) => {
  ctx.log("=== getTimeline START ===");
  try {
    const userId = req.params.userId;
    const dateFrom = req.query.get("dateFrom");
    const dateTo = req.query.get("dateTo");
    
    ctx.log("Request params:", { userId, dateFrom, dateTo });
    
    if (!userId) {
      ctx.log("ERROR: Missing userId");
      return { 
        status: 400, 
        jsonBody: { error: "Missing userId parameter" } 
      };
    }

    ctx.log("Initializing Cosmos client...");
    const { timeline } = cosmos();
    ctx.log("Cosmos client initialized");
    
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

    ctx.log("Executing query:", query);
    ctx.log("Query parameters:", parameters);

    const { resources } = await timeline.items
      .query({
        query,
        parameters
      })
      .fetchAll();

    ctx.log("Query successful, found", resources.length, "days");
    return { status: 200, jsonBody: { days: resources } };
  } catch (e) {
    ctx.log("=== getTimeline ERROR ===");
    ctx.log("Error type:", e.constructor.name);
    ctx.log("Error message:", e.message);
    ctx.log("Error code:", e.code);
    ctx.log("Error stack:", e.stack);
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
