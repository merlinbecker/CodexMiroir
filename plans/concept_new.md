## Ziel

Du möchtest eine **minimalistische App namens Codex Miroir** umsetzen, die deine Aufgaben strikt nach einem **FIFO-Prinzip** verwaltet.  
Die App ist **kein klassisches To-Do-Board**, sondern ein **Spiegelkodex**: eine einfache Liste, die immer nur den aktuellen Task zeigt und dadurch Fokus erzwingt, mentale Last reduziert und Vorgesetzten die Realität ihrer Aufträge sichtbar macht.

---

## Grundprinzipien

- **Zwei getrennte Backlogs:**
    
    - **beruflich (pro)** → Montag–Freitag, 2 Slots pro Tag (Vormittag, Nachmittag).
        
    - **privat (priv)** → Montag–Freitag 1 Slot pro Tag (Vormittag), Samstag/Sonntag 2 Slots.
        
- **Tasks:**
    
    - immer in **3,5-h-Chunks** (1 Slot).
        
    - Eigenschaften: Titel, Notiz, optional Azure DevOps Ticket, Ansprechpartner, Projekt, Deadline, Kategorie (meeting/programmierung oder haushalt/projekt).
        
    - **Kein Pausieren:** wenn nicht bearbeitbar → Task wandert automatisch ans Ende.
        
- **Anzeige:**
    
    - **Prominent:** der aktuelle Task.
        
    - Darunter: eine scrollbare FIFO-Liste (nicht editierbar).
        
    - Wechsel zwischen beruflich/privat per Dark-/Lightmode.
        

---

## Datenhaltung

Alle Daten liegen als **Markdown-Dateien** in einem **Azure Storage Account**:

- **Tasks:** jede Aufgabe als eigene `.md`-Datei mit Frontmatter (Metadaten) und Body (Notiz, Verlauf).
    
- **current.md:** zeigt alle geplanten/fälligen Tasks, gruppiert nach Woche (`## Woche YYYY-Www` mit Tabelle).
    
- **archive.md:** enthält abgeschlossene Tasks, ebenfalls tabellarisch nach Wochen.
    
- **Datumsformat:** immer **dd.mm.yyyy [HH:MM]** (europäisch).
    

---

## Funktionen (App + Agent)

- **Task anlegen:** neue Datei + Eintrag in `current.md`.
    
- **Task abschließen:** Status ändern, aus `current.md` entfernen, in `archive.md` eintragen.
    
- **Task verschieben (nicht bearbeitbar):** ans Ende der jeweiligen Wochen-Tabelle.
    
- **Reporting:** Auswertung nach Kategorien (z. B. Meeting vs. Programmierung), „wann dran?“ für einzelne Tasks.
    

---

## Umsetzung

- **Backend:** Azure Function (HTTP), eine einzige Schnittstelle für CRUD + Reporting.
    
- **Sicherheit:** einfacher API-Key per Header (`x-api-key`).
    
- **Formate:** schlankes Markdown + Tabellen → sowohl lesbar für Menschen als auch maschinenverarbeitbar.
    
- **Kein Overhead:** keine Animationen, kein Drag-&-Drop, keine CSVs.
    

---

## Nutzen

- **Fokus:** immer nur ein Task sichtbar, keine Multitasking-Spielchen.
    
- **Klarheit:** einfache, nachvollziehbare Reihenfolge.
    
- **Transparenz:** zeigt Auftraggebern automatisch die Last, die sie selbst erzeugen.
    
- **Entlastung:** Kopf frei, weil alles im Kodex steht – sichtbar, aber nicht verwaltbar.
    
# Minimal-Standards (Markdown)

## Task-Datei

`/codex-miroir/<list>/tasks/<YYYY>/<YYYY-MM-DD>--<id>-<slug>.md`

```markdown
---
id: T-0123
list: pro              # 'pro' | 'priv'
title: "API Spec"
status: geplant        # geplant | aktiv | abgeschlossen
created_at: 23.09.2025 09:12
scheduled_slot: 2025-W39-Tue-AM
duration_slots: 1
deadline: 30.09.2025 16:00
project:
azure_devops:
requester:
category_pro: programmierung   # pro: meeting | programmierung
category_priv:                 # priv: haushalt | projekt
---
## Notiz
kurz…

## Verlauf
- 23.09.2025 09:15 → geplant in `2025-W39-Tue-AM`
```

## current.md (pro/priv)

`/codex-miroir/<list>/current.md`

```markdown
# Codex Miroir — CURRENT (pro)

> Aktueller Slot: `2025-W39-Tue-AM`

## Woche 2025-W39
| Slot-ID           | Task                                | Kategorie        | Deadline        |
|-------------------|-------------------------------------|------------------|-----------------|
| 2025-W39-Tue-AM   | [T-0123: API Spec](./tasks/2025/2025-09-23--T-0123-api-spec.md) | programmierung | 30.09.2025 16:00 |
| 2025-W39-Tue-PM   | [T-0124: Stakeholder Sync](./tasks/2025/2025-09-23--T-0124-sync.md) | meeting      |                 |
```

## archive.md (pro/priv)

`/codex-miroir/<list>/archive.md`

```markdown
# Codex Miroir — ARCHIVE (pro)

## Woche 2025-W39
| Abgeschlossen am     | Slot-ID           | Task                                  | Kategorie        | Dauer |
|----------------------|-------------------|---------------------------------------|------------------|-------|
| 24.09.2025 16:45     | 2025-W39-Wed-PM   | [T-0123: API Spec](./tasks/2025/2025-09-23--T-0123-api-spec.md) | programmierung | 1     |
```

**Hinweise**

- **Slots** bleiben ISO-like (`YYYY-Www-DOW-AM/PM`) → stabil und maschinenfreundlich.
    
- **Alle sichtbaren Datumswerte** in **dd.mm.yyyy [HH:MM]**.
    
- Tabellenköpfe sind **fix**. Wochen sind über `## Woche YYYY-Www` trennbar (keine Marker nötig).
    

---

# Azure Function (HTTP, eine Datei)

## `package.json`

```json
{
  "name": "codex-miroir-fn",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "index.js",
  "dependencies": {
    "@azure/storage-blob": "^12.18.0",
    "gray-matter": "^4.0.3"
  }
}
```

## `function.json`

```json
{
  "bindings": [
    { "authLevel": "function", "type": "httpTrigger", "direction": "in", "name": "req", "methods": ["get","post"], "route": "codex" },
    { "type": "http", "direction": "out", "name": "res" }
  ]
}
```

## `index.js`

```js
const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");

const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";
const API_KEY = process.env.API_KEY;

const blob = () => BlobServiceClient.fromConnectionString(CONN).getContainerClient(CONTAINER);

const readText = async (path) => {
  const bc = blob().getBlobClient(path);
  if (!(await bc.exists())) return null;
  const buf = await bc.downloadToBuffer();
  return buf.toString("utf-8");
};
const writeText = async (path, text) => {
  const bc = blob().getBlockBlobClient(path);
  await bc.upload(text, Buffer.byteLength(text), { blobHTTPHeaders: { blobContentType: "text/markdown; charset=utf-8" } });
};

const auth = (req) => {
  if (!API_KEY || req.headers["x-api-key"] !== API_KEY) {
    const e = new Error("unauthorized"); e.code = 401; throw e;
  }
};

const weekOf = (slot) => slot.split("-").slice(0,2).join("-"); // "2025-W39"
const ymd = (iso) => iso.slice(0,10); // for path segment (YYYY-MM-DD)
const ddmmyyyy = (d) => { // expects "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD"
  if (!d) return "";
  const [date, time] = d.split("T");
  const [Y, M, D] = date.split("-");
  return `${D}.${M}.${Y}${time ? " " + time.slice(0,5) : ""}`;
};

const extractWeek = (md, week) => {
  const re = new RegExp(`## Woche ${week}[\\s\\S]*?(?=\\n## |$)`, "m");
  const m = re.exec(md || "");
  return m ? m[0] : null;
};
const replaceWeek = (md, week, newBlock) => {
  const re = new RegExp(`(## Woche ${week})[\\s\\S]*?(?=\\n## |$)`, "m");
  if (re.test(md || "")) return (md || "").replace(re, `## Woche ${week}\n${newBlock.trim()}\n`);
  return `${(md || "").trim()}\n\n## Woche ${week}\n${newBlock.trim()}\n`;
};

const ensureTableCurrent = (sec) => {
  const header = `| Slot-ID           | Task | Kategorie | Deadline |\n|-------------------|:-----|:----------|:--------|\n`;
  if (!sec) return header;
  if (sec.includes("| Slot-ID") && sec.includes("|---")) return sec;
  return `## Dummy\n${header}`.split("\n").slice(1).join("\n");
};
const ensureTableArchive = (sec) => {
  const header = `| Abgeschlossen am   | Slot-ID           | Task | Kategorie | Dauer |\n|--------------------|:------------------|:-----|:----------|:------|\n`;
  if (!sec) return header;
  if (sec.includes("| Abgeschlossen am") && sec.includes("|---")) return sec;
  return `## Dummy\n${header}`.split("\n").slice(1).join("\n");
};

const appendRow = (sec, row) => {
  const lines = sec.trim().split("\n"); lines.push(row); return lines.join("\n");
};
const removeRowByRelLink = (sec, rel) => sec.split("\n").filter(l => !l.includes(`](${rel})`)).join("\n");

async function createTask(body) {
  const { list, id, title, created_at_iso, scheduled_slot, category, deadline_iso, project, azure_devops, requester, duration_slots = 1 } = body;
  if (!list || !id || !title || !created_at_iso || !scheduled_slot) throw new Error("missing fields");

  const year = ymd(created_at_iso).slice(0,4);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  const relTask = `./tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;
  const absTask = `/codex-miroir/${list}/tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;

  const fm = {
    id, list, title, status: "geplant",
    created_at: ddmmyyyy(created_at_iso),
    scheduled_slot,
    duration_slots,
    deadline: deadline_iso ? ddmmyyyy(deadline_iso) : "",
    project, azure_devops, requester,
    category_pro: list==="pro" ? category : undefined,
    category_priv: list==="priv"? category : undefined
  };
  const taskMD = matter.stringify(
    `## Notiz\n\nkurz…\n\n## Verlauf\n- ${ddmmyyyy(created_at_iso)} → geplant in \`${scheduled_slot}\`\n`,
    fm
  );
  await writeText(absTask, taskMD);

  // current.md
  const week = weekOf(scheduled_slot);
  const currentPath = `/codex-miroir/${list}/current.md`;
  let current = await readText(currentPath) || `# Codex Miroir — CURRENT (${list})\n\n> Aktueller Slot: \`${scheduled_slot}\`\n`;
  let sec = extractWeek(current, week) || `## Woche ${week}\n${ensureTableCurrent("")}`;
  const row = `| ${scheduled_slot.padEnd(19)} | [${id}: ${title}](${relTask}) | ${category||""} | ${deadline_iso? ddmmyyyy(deadline_iso):""} |`;
  sec = appendRow(sec, row);
  current = replaceWeek(current, week, sec);
  await writeText(currentPath, current);

  return { ok: true, taskPath: absTask, currentPath };
}

async function completeTask(body) {
  const { list, taskPathAbs, closed_at_iso } = body;
  if (!list || !taskPathAbs || !closed_at_iso) throw new Error("missing fields");

  const md = await readText(taskPathAbs);
  if (!md) throw new Error("task not found");
  const parsed = matter(md); const fm = parsed.data;
  fm.status = "abgeschlossen"; fm.closed_at = ddmmyyyy(closed_at_iso);
  await writeText(taskPathAbs, matter.stringify(parsed.content, fm));

  // remove from current
  const currentPath = `/codex-miroir/${list}/current.md`;
  let current = await readText(currentPath) || "";
  const week = weekOf(fm.scheduled_slot);
  const sec = extractWeek(current, week);
  if (sec) {
    const newSec = removeRowByRelLink(sec, taskPathAbs.replace("/codex-miroir","."));
    current = replaceWeek(current, week, newSec);
    await writeText(currentPath, current);
  }

  // append to archive
  const archivePath = `/codex-miroir/${list}/archive.md`;
  let archive = await readText(archivePath) || `# Codex Miroir — ARCHIVE (${list})\n`;
  let aSec = extractWeek(archive, week) || `## Woche ${week}\n${ensureTableArchive("")}`;
  const rel = taskPathAbs.replace("/codex-miroir",".");
  const cat = (fm.category_pro || fm.category_priv) || "";
  const row = `| ${fm.closed_at} | ${fm.scheduled_slot} | [${fm.id}: ${fm.title}](${rel}) | ${cat} | ${fm.duration_slots||1} |`;
  aSec = appendRow(aSec, row);
  archive = replaceWeek(archive, week, aSec);
  await writeText(archivePath, archive);

  return { ok: true, archivePath };
}

async function pushToEnd(body) {
  const { list, week, taskRelLink } = body;
  if (!list || !week || !taskRelLink) throw new Error("missing fields");
  const currentPath = `/codex-miroir/${list}/current.md`;
  let current = await readText(currentPath) || "";
  const sec = extractWeek(current, week);
  if (!sec) return { ok: true, note: "no week section" };
  const lines = sec.split("\n");
  const headIdx = lines.findIndex(l => l.startsWith("| Slot-ID"));
  const head = lines.slice(0, headIdx + 2);
  const rows = lines.slice(headIdx + 2).filter(Boolean);
  const idx = rows.findIndex(l => l.includes(`](${taskRelLink})`));
  if (idx < 0) return { ok: true, note: "row not found" };
  const [r] = rows.splice(idx, 1); rows.push(r);
  const newSec = [...head, ...rows].join("\n") + "\n";
  current = replaceWeek(current, week, newSec);
  await writeText(currentPath, current);
  return { ok: true };
}

async function report(query) {
  const { list, week } = query;
  const md = await readText(`/codex-miroir/${list}/archive.md`) || "";
  const sec = extractWeek(md, week) || "";
  const rows = sec.split("\n").filter(l => l.startsWith("|") && !l.includes("---"));
  let meetings=0,coding=0,haushalt=0,projekt=0,total=0;
  for (const r of rows) {
    const cols = r.split("|").map(s=>s.trim());
    const cat = (cols[4]||"").toLowerCase();
    if (cat==="meeting") meetings++;
    if (cat==="programmierung") coding++;
    if (cat==="haushalt") haushalt++;
    if (cat==="projekt") projekt++;
    total++;
  }
  return { list, week, meetings, programmierung:coding, haushalt, projekt, total };
}

async function when(query) {
  const { list, week, id } = query;
  const md = await readText(`/codex-miroir/${list}/current.md`) || "";
  const sec = extractWeek(md, week); if (!sec) return null;
  const rows = sec.split("\n").filter(l => l.startsWith("|") && !l.includes("---"));
  for (let i=0;i<rows.length;i++){
    const cols = rows[i].split("|").map(s=>s.trim());
    const slotId = cols[1]; const taskCol = cols[2] || "";
    if (taskCol.includes(`[${id}:`)) return { position: i+1, slotId };
  }
  return null;
}

module.exports = async function (context, req) {
  try {
    auth(req);
    const a = (req.query.action || "").toLowerCase();
    if (req.method === "POST" && a === "createtask")  return context.res = { status: 200, jsonBody: await createTask(req.body||{}) };
    if (req.method === "POST" && a === "completetask")return context.res = { status: 200, jsonBody: await completeTask(req.body||{}) };
    if (req.method === "POST" && a === "pushtoend")  return context.res = { status: 200, jsonBody: await pushToEnd(req.body||{}) };
    if (req.method === "GET"  && a === "report")     return context.res = { status: 200, jsonBody: await report(req.query) };
    if (req.method === "GET"  && a === "when")       return context.res = { status: 200, jsonBody: await when(req.query) };
    context.res = { status: 400, body: "Unknown action" };
  } catch (e) {
    context.res = { status: e.code || 500, body: e.message };
  }
};
```

---

## Endpunkte (kompakt)

- **Create**  
    `POST /api/codex?action=createTask`  
    Body:
    
    ```json
    {
      "list":"pro",
      "id":"T-0123",
      "title":"API Spec",
      "created_at_iso":"2025-09-23T09:12:00+02:00",
      "scheduled_slot":"2025-W39-Tue-AM",
      "category":"programmierung",
      "deadline_iso":"2025-09-30T16:00:00+02:00"
    }
    ```
    
- **Complete**  
    `POST /api/codex?action=completeTask`
    
    ```json
    {
      "list":"pro",
      "taskPathAbs":"/codex-miroir/pro/tasks/2025/2025-09-23--T-0123-api-spec.md",
      "closed_at_iso":"2025-09-24T16:45:00+02:00"
    }
    ```
    
- **Nicht bearbeitbar → ans Ende**  
    `POST /api/codex?action=pushToEnd`
    
    ```json
    { "list":"pro", "week":"2025-W39", "taskRelLink":"./tasks/2025/2025-09-23--T-0123-api-spec.md" }
    ```
    
- **Report (Ratio)**  
    `GET /api/codex?action=report&list=pro&week=2025-W39`
    
- **Wann dran?**  
    `GET /api/codex?action=when&list=pro&week=2025-W39&id=T-0123`
    

---

### Warum das jetzt „schlank“ ist

- **Eine** Function, **4** Aktionen.
    
- **Keine Marker**, nur `## Woche YYYY-Www`.
    
- **EU-Datumsformat** in allen sichtbaren Feldern.
    
- **Kein CSV**, nur Markdown-Tabellen (menschlich + maschinenlesbar).
    
- Minimal-Dependencies: Blob-SDK + gray-matter.
    
