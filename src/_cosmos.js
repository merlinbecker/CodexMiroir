// Gemeinsamer Cosmos-Client
import { CosmosClient } from "@azure/cosmos";

export function cosmos() {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  
  if (!connectionString) {
    throw new Error("COSMOS_CONNECTION_STRING environment variable is required");
  }

  try {
    const client = new CosmosClient(connectionString);
    const db = client.database(process.env.COSMOS_DB || "codexmiroir");
    
    return {
      client,
      db,
      tasks: db.container(process.env.COSMOS_TASKS || "tasks"),
      timeline: db.container(process.env.COSMOS_TIMELINE || "timeline")
    };
  } catch (e) {
    console.error("Cosmos initialization error:", e.message);
    throw e;
  }
}
