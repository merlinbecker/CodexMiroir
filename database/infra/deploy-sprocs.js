// infra/deploy-sprocs.js
import { CosmosClient } from "@azure/cosmos";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function upsertSproc(container, id, body) {
  try {
    await container.scripts.storedProcedure(id).replace({ id, body });
    console.log("replaced sproc:", id);
  } catch {
    await container.scripts.storedProcedures.create({ id, body });
    console.log("created sproc:", id);
  }
}

function read(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".js"))
    .map(f => ({ id: path.parse(f).name, body: fs.readFileSync(path.join(dir, f), "utf8") }));
}

(async () => {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) {
    console.error("ERROR: COSMOS_CONNECTION_STRING environment variable is required");
    process.exit(1);
  }

  const client = new CosmosClient(connectionString);
  const db = client.database(process.env.COSMOS_DB || "codexmiroir");
  const contTimeline = db.container(process.env.COSMOS_TIMELINE || "timeline");
  const contTasks = db.container(process.env.COSMOS_TASKS || "tasks");

  // Robuste Pfadangaben relativ zum Skriptstandort
  const timelineDir = path.resolve(__dirname, '../timeline');
  const pretriggersDir = path.resolve(__dirname, '../pretriggers/tasks');

  for (const { id, body } of read(timelineDir)) {
    await upsertSproc(contTimeline, id, body);
  }

  for (const { id, body } of read(pretriggersDir)) {
    try {
      await contTasks.scripts.trigger(id).replace({ id, body, triggerType: "Pre", triggerOperation: "All" });
      console.log("replaced trigger:", id);
    } catch {
      await contTasks.scripts.triggers.create({ id, body, triggerType: "Pre", triggerOperation: "All" });
      console.log("created trigger:", id);
    }
  }
  console.log("done.");
})();
