
import { BlobServiceClient } from "@azure/storage-blob";

const conn = process.env.AZURE_BLOB_CONN;
const containerName = process.env.AZURE_BLOB_CONTAINER || "codex-cache";
const NEXT_ID_BLOB = "state/nextId.txt";

function svc() {
  return BlobServiceClient.fromConnectionString(conn);
}

async function ensureContainer() {
  const c = svc().getContainerClient(containerName);
  await c.createIfNotExists();
  return c;
}

async function acquireLease(blobClient, seconds = 15) {
  try {
    const { leaseId } = await blobClient.getBlockBlobClient().acquireLease(seconds);
    return leaseId;
  } catch (e) {
    // Blob noch nicht vorhanden: anlegen
    if (e.statusCode === 404) {
      await blobClient.upload("0", 1, { 
        blobHTTPHeaders: { blobContentType: "text/plain" } 
      });
      const { leaseId } = await blobClient.getBlockBlobClient().acquireLease(seconds);
      return leaseId;
    }
    throw e;
  }
}

async function streamToBuffer(s) {
  const chunks = [];
  for await (const ch of s) {
    chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch));
  }
  return Buffer.concat(chunks);
}

async function withIdLock() {
  const c = await ensureContainer();
  const b = c.getBlockBlobClient(NEXT_ID_BLOB);
  const leaseId = await acquireLease(b);
  
  try {
    const dl = await b.download(0, undefined, { conditions: { leaseId } });
    const buf = await streamToBuffer(dl.readableStreamBody);
    const cur = parseInt(buf.toString("utf8").trim() || "0", 10);
    const next = isNaN(cur) ? 0 : cur;
    const id = String(next).padStart(4, "0");
    const newVal = String(next + 1);
    
    await b.upload(Buffer.from(newVal, "utf8"), Buffer.byteLength(newVal), {
      conditions: { leaseId },
      blobHTTPHeaders: { blobContentType: "text/plain" }
    });
    
    return id;
  } finally {
    await b.releaseLease(leaseId);
  }
}

export { withIdLock };
