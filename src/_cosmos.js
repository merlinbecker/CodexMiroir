// Gemeinsamer Cosmos-Client
import { CosmosClient } from "@azure/cosmos";

export function cosmos() {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  
  console.log("=== Cosmos Init ===");
  console.log("Connection String exists:", !!connectionString);
  console.log("Connection String length:", connectionString?.length);
  console.log("COSMOS_DB:", process.env.COSMOS_DB);
  console.log("COSMOS_TIMELINE:", process.env.COSMOS_TIMELINE);
  console.log("COSMOS_TASKS:", process.env.COSMOS_TASKS);
  
  if (!connectionString) {
    throw new Error("COSMOS_CONNECTION_STRING environment variable is required");
  }

  try {
    console.log("Creating CosmosClient...");
    const client = new CosmosClient(connectionString);
    console.log("CosmosClient created");
    
    const db = client.database(process.env.COSMOS_DB || "codexmiroir");
    console.log("Database reference created:", process.env.COSMOS_DB || "codexmiroir");
    
    const result = {
      client,
      db,
      tasks: db.container(process.env.COSMOS_TASKS || "tasks"),
      timeline: db.container(process.env.COSMOS_TIMELINE || "timeline")
    };
    
    console.log("Cosmos client initialization complete");
    return result;
  } catch (e) {
    console.error("=== Cosmos Init ERROR ===");
    console.error("Error:", e.message);
    console.error("Stack:", e.stack);
    throw e;
  }
}
