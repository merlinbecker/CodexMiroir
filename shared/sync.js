// shared/sync.js
import { putTextBlob, deleteBlob, list as listBlobs, getTextBlob } from "./storage.js";

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(
  /\/+$/,
  "",
);
const TOKEN = process.env.GITHUB_TOKEN;

async function gh(url, accept = "application/vnd.github.v3+json") {
  const r = await fetch(`https://api.github.com${url}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "codex-miroir",
      Accept: accept,
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${url}`);
  return r;
}

function toBlobPath(repoPath) {
  // codex-miroir/tasks/x.md -> raw/tasks/x.md
  return `raw/${repoPath.replace(`${BASE}/`, "")}`;
}

async function fetchFileAtRef(repoPath, ref) {
  // Don't encode the path slashes - GitHub API expects them as-is
  const r = await gh(
    `/repos/${OWNER}/${REPO}/contents/${repoPath}?ref=${ref}`,
  );
  const j = await r.json();
  if (j.type !== "file") return null;
  if (j.encoding === "base64" && j.content)
    return Buffer.from(j.content, "base64").toString("utf8");
  const raw = await fetch(j.download_url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!raw.ok) throw new Error(`RAW ${raw.status} ${j.download_url}`);
  return await raw.text();
}

async function listMdUnderTasks(ref) {
  const path = `${BASE}/tasks`;
  // Don't encode the path slashes - GitHub API expects them as-is
  const r = await gh(
    `/repos/${OWNER}/${REPO}/contents/${path}?ref=${ref}`,
  );
  const arr = await r.json();
  return arr
    .filter((x) => x.type === "file" && x.name.endsWith(".md"))
    .map((x) => ({ repoPath: `${path}/${x.name}` }));
}

async function fullSync(ref = BRANCH, clean = false) {
  const files = await listMdUnderTasks(ref);
  let changed = 0;
  let maxId = -1;
  
  for (const f of files) {
    const text = await fetchFileAtRef(f.repoPath, ref);
    if (!text) continue;
    await putTextBlob(toBlobPath(f.repoPath), text, "text/markdown");
    changed++;
    
    // Extrahiere ID aus Dateinamen (z.B. 0005-Titel.md -> 5 oder 0005.md -> 5)
    const match = f.repoPath.match(/(\d{4})(-[^/]+)?\.md$/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (id > maxId) maxId = id;
    }
  }
  
  let removed = 0;
  if (clean) {
    const existing = new Set(files.map((f) => toBlobPath(f.repoPath)));
    const blobs = await listBlobs(`raw/tasks/`);
    for (const b of blobs) {
      if (!existing.has(b)) {
        await deleteBlob(b);
        removed++;
      }
    }
  }
  
  // State komplett neu aufbauen
  
  // 1. WICHTIG: Alle alten raw/tasks/*.md Blobs löschen VOR dem Schreiben der neuen
  if (clean) {
    const oldRawBlobs = await listBlobs("raw/tasks/");
    for (const blob of oldRawBlobs) {
      await deleteBlob(blob);
      removed++;
    }
  }
  
  // 2. Neue Tasks aus GitHub schreiben (wurde oben schon gemacht)
  
  // 3. headSha speichern (wichtig für Timeline-Cache-Invalidierung)
  await putTextBlob("state/lastHeadSha.txt", ref, "text/plain");
  
  // 4. nextId.txt aktualisieren: höchste ID + 1
  const nextId = maxId >= 0 ? maxId + 1 : 0;
  await putTextBlob("state/nextId.txt", String(nextId), "text/plain");
  
  // 5. Timeline-Cache komplett löschen
  const artifactBlobs = await listBlobs("artifacts/");
  for (const blob of artifactBlobs) {
    await deleteBlob(blob);
  }
  
  // Erfolgsmeldung
  return { 
    scope: "tasks", 
    mode: "full", 
    changed, 
    removed, 
    nextId,
    cacheCleared: artifactBlobs.length
  };
}

async function applyDiff({ addedOrModified = [], removed = [] }, ref = BRANCH) {
  let changed = 0,
    deleted = 0,
    skipped = 0,
    maxId = -1;
    
  for (const p of removed) {
    if (!p.endsWith(".md")) {
      skipped++;
      continue;
    }
    await deleteBlob(toBlobPath(p));
    deleted++;
  }
  
  for (const p of addedOrModified) {
    if (!p.endsWith(".md")) {
      skipped++;
      continue;
    }
    const text = await fetchFileAtRef(p, ref);
    if (!text) {
      skipped++;
      continue;
    }
    await putTextBlob(toBlobPath(p), text, "text/markdown");
    changed++;
    
    // Extrahiere ID aus Pfad (z.B. codex-miroir/tasks/0005-Titel.md -> 5 oder 0005.md -> 5)
    const match = p.match(/(\d{4})(-[^/]+)?\.md$/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (id > maxId) maxId = id;
    }
  }

  // headSha speichern für Timeline-Cache-Invalidierung
  await putTextBlob("state/lastHeadSha.txt", ref, "text/plain");
  
  // nextId.txt aktualisieren, wenn neue Tasks hinzugefügt wurden
  if (maxId >= 0) {
    // Prüfe aktuelle nextId und nimm das Maximum
    const current = await getTextBlob("state/nextId.txt");
    const currentId = current ? parseInt(current.trim(), 10) : 0;
    const nextId = Math.max(currentId, maxId + 1);
    await putTextBlob("state/nextId.txt", String(nextId), "text/plain");
  }

  return { scope: "tasks", mode: "diff", changed, deleted, skipped, ref, nextId: maxId >= 0 ? maxId + 1 : null };
}

export { fullSync, applyDiff };