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

    return { status: 200, jsonBody: { days: resources } };
  } catch (e) {
    return errorResponse(e, ctx);
  }
}});
