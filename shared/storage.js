const { BlobServiceClient } = require("@azure/storage-blob");

const conn = process.env.AZURE_BLOB_CONN;
const containerName = process.env.AZURE_BLOB_CONTAINER || "codex-cache";

function svc() {
  return BlobServiceClient.fromConnectionString(conn);
}

async function ensureContainer() {
  const c = svc().getContainerClient(containerName);
  await c.createIfNotExists();
  return c;
}

async function putTextBlob(path, text, contentType = "text/markdown") {
  const c = await ensureContainer();
  const b = c.getBlockBlobClient(path);
  const data = Buffer.from(text, "utf8");
  await b.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

async function putBufferBlob(
  path,
  buffer,
  contentType = "application/octet-stream",
) {
  const c = await ensureContainer();
  const b = c.getBlockBlobClient(path);
  await b.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

async function getTextBlob(path) {
  const c = await ensureContainer();
  const b = c.getBlobClient(path);
  if (!(await b.exists())) return null;
  const dl = await b.download();
  const chunks = [];
  for await (const chunk of dl.readableStreamBody)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function deleteBlob(path) {
  const c = await ensureContainer();
  const b = c.getBlockBlobClient(path);
  await b.deleteIfExists();
}

async function list(prefix) {
  const c = await ensureContainer();
  const out = [];
  for await (const blob of c.listBlobsFlat({ prefix })) out.push(blob.name);
  return out;
}

export { putTextBlob, putBufferBlob, getTextBlob, deleteBlob, list };