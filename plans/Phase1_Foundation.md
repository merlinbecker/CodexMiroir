# Phase 1: Minimale Azure Function Setup - "Codex Miroir"

## Übersicht
Diese Phase implementiert eine **ultra-minimalistische Azure Function** basierend auf dem neuen Konzept. Fokus liegt auf Einfachheit und dem strikten FIFO-Prinzip ohne komplexe User-Management oder DI-Container.

## Ziele
- Eine Azure Function mit allen 5 Actions
- Azure Blob Storage für Markdown-Dateien  
- API-Key basierte Authentifizierung
- Europäisches Datumsformat durchgängig

## Vereinfachte Struktur
```
codex-miroir-fn/
├── function.json
├── package.json
├── index.js          # Komplette Logik in einer Datei
└── host.json
```

## Aufgaben

### 1.1 Azure Functions Projekt Setup (1 Stunde)
**Geschätzter Aufwand**: 1 Stunde

#### Minimale Dependencies
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

#### Function Configuration
```json
{
  "bindings": [
    { 
      "authLevel": "function", 
      "type": "httpTrigger", 
      "direction": "in", 
      "name": "req", 
      "methods": ["get","post"], 
      "route": "codex" 
    },
    { 
      "type": "http", 
      "direction": "out", 
      "name": "res" 
    }
  ]
}
```

#### Host Configuration
```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": ""
    }
  },
  "functionTimeout": "00:02:00"
}
```

### 1.2 Blob Storage Integration (1 Stunde)
**Geschätzter Aufwand**: 1 Stunde

#### Storage Helper Functions
```javascript
const { BlobServiceClient } = require("@azure/storage-blob");

const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";

const blob = () => BlobServiceClient.fromConnectionString(CONN).getContainerClient(CONTAINER);

const readText = async (path) => {
  const bc = blob().getBlobClient(path);
  if (!(await bc.exists())) return null;
  const buf = await bc.downloadToBuffer();
  return buf.toString("utf-8");
};

const writeText = async (path, text) => {
  const bc = blob().getBlockBlobClient(path);
  await bc.upload(text, Buffer.byteLength(text), { 
    blobHTTPHeaders: { blobContentType: "text/markdown; charset=utf-8" } 
  });
};
```

#### Container Structure
```
codex-miroir/
├── pro/
│   ├── current.md
│   ├── archive.md
│   └── tasks/
│       └── 2025/
│           └── 2025-09-23--T-0123-api-spec.md
└── priv/
    ├── current.md
    ├── archive.md
    └── tasks/
        └── 2025/
            └── 2025-09-23--T-0456-haushalt.md
```

### 1.3 Authentication & Core Functions (2 Stunden)
**Geschätzter Aufwand**: 2 Stunden

#### API-Key Authentication
```javascript
const API_KEY = process.env.API_KEY;

const auth = (req) => {
  if (!API_KEY || req.headers["x-api-key"] !== API_KEY) {
    const e = new Error("unauthorized"); 
    e.code = 401; 
    throw e;
  }
};
```

#### Date Format Utilities
```javascript
const ddmmyyyy = (d) => {
  if (!d) return "";
  const [date, time] = d.split("T");
  const [Y, M, D] = date.split("-");
  return `${D}.${M}.${Y}${time ? " " + time.slice(0,5) : ""}`;
};

const weekOf = (slot) => slot.split("-").slice(0,2).join("-"); // "2025-W39"
const ymd = (iso) => iso.slice(0,10); // YYYY-MM-DD for paths
```

### 1.4 Markdown Table Management (2 Stunden)  
**Geschätzter Aufwand**: 2 Stunden

#### Week Section Extraction
```javascript
const extractWeek = (md, week) => {
  const re = new RegExp(`## Woche ${week}[\\s\\S]*?(?=\\n## |$)`, "m");
  const m = re.exec(md || "");
  return m ? m[0] : null;
};

const replaceWeek = (md, week, newBlock) => {
  const re = new RegExp(`(## Woche ${week})[\\s\\S]*?(?=\\n## |$)`, "m");
  if (re.test(md || "")) {
    return (md || "").replace(re, `## Woche ${week}\n${newBlock.trim()}\n`);
  }
  return `${(md || "").trim()}\n\n## Woche ${week}\n${newBlock.trim()}\n`;
};
```

#### Table Management
```javascript
const ensureTableCurrent = (sec) => {
  const header = `| Slot-ID           | Task | Kategorie | Deadline |\n|-------------------|:-----|:----------|:--------|\n`;
  if (!sec) return header;
  if (sec.includes("| Slot-ID") && sec.includes("|---")) return sec;
  return `## Dummy\n${header}`.split("\n").slice(1).join("\n");
};

const appendRow = (sec, row) => {
  const lines = sec.trim().split("\n"); 
  lines.push(row); 
  return lines.join("\n");
};

const removeRowByRelLink = (sec, rel) => 
  sec.split("\n").filter(l => !l.includes(`](${rel})`)).join("\n");
```

### 1.5 Main Function Implementation (2 Stunden)
**Geschätzter Aufwand**: 2 Stunden

#### Complete index.js Structure
```javascript
const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");

// Environment & Authentication
const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";
const API_KEY = process.env.API_KEY;

// Storage helpers (defined above)
// Date utilities (defined above)
// Table management (defined above)

// Action Functions
async function createTask(body) {
  const { list, id, title, created_at_iso, scheduled_slot, category, deadline_iso, project, azure_devops, requester, duration_slots = 1 } = body;
  if (!list || !id || !title || !created_at_iso || !scheduled_slot) {
    throw new Error("missing fields");
  }

  // Generate file paths
  const year = ymd(created_at_iso).slice(0,4);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  const relTask = `./tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;
  const absTask = `/codex-miroir/${list}/tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;

  // Create task file with frontmatter
  const fm = {
    id, list, title, status: "geplant",
    created_at: ddmmyyyy(created_at_iso),
    scheduled_slot, duration_slots,
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

  // Update current.md
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

  // Update task file
  const md = await readText(taskPathAbs);
  if (!md) throw new Error("task not found");
  const parsed = matter(md); 
  const fm = parsed.data;
  fm.status = "abgeschlossen"; 
  fm.closed_at = ddmmyyyy(closed_at_iso);
  await writeText(taskPathAbs, matter.stringify(parsed.content, fm));

  // Remove from current.md and add to archive.md
  // (Implementation as shown in concept_new.md)
  
  return { ok: true, archivePath };
}

// Main Azure Function
module.exports = async function (context, req) {
  try {
    auth(req);
    const a = (req.query.action || "").toLowerCase();
    
    if (req.method === "POST" && a === "createtask")  {
      return context.res = { status: 200, jsonBody: await createTask(req.body||{}) };
    }
    if (req.method === "POST" && a === "completetask") {
      return context.res = { status: 200, jsonBody: await completeTask(req.body||{}) };
    }
    if (req.method === "POST" && a === "pushtoend") {
      return context.res = { status: 200, jsonBody: await pushToEnd(req.body||{}) };
    }
    if (req.method === "GET"  && a === "report") {
      return context.res = { status: 200, jsonBody: await report(req.query) };
    }
    if (req.method === "GET"  && a === "when") {
      return context.res = { status: 200, jsonBody: await when(req.query) };
    }
    
    context.res = { status: 400, body: "Unknown action" };
  } catch (e) {
    context.res = { status: e.code || 500, body: e.message };
  }
};
```

## Testing Strategy (Vereinfacht)

### Local Testing
```bash
# Azure Functions Core Tools
func start

# Test API calls
curl -H "x-api-key: test-key" \
     -H "Content-Type: application/json" \
     -d '{"list":"pro","id":"T-001","title":"Test","created_at_iso":"2025-01-20T10:00:00","scheduled_slot":"2025-W03-Mon-AM","category":"programmierung"}' \
     http://localhost:7071/api/codex?action=createTask
```

### Storage Validation
```bash
# Check blob storage content
az storage blob list --account-name myaccount --container-name codex-miroir
```

## Deliverables

### Code Artifacts
- [ ] function.json (HTTP Trigger Config)
- [ ] package.json (Minimale Dependencies)  
- [ ] index.js (Komplette Function Logik)
- [ ] host.json (Runtime Config)

### Environment Setup
- [ ] Azure Storage Account
- [ ] Blob Container "codex-miroir"
- [ ] API Key Environment Variable
- [ ] Connection String konfiguriert

### Validation
- [ ] Function local lauffähig
- [ ] Blob Storage Integration funktional
- [ ] API-Key Authentication aktiv
- [ ] Alle 5 Actions implementiert

## Akzeptanzkriterien

### Funktional
- ✅ createTask erstellt Task-Datei + current.md Eintrag
- ✅ completeTask markiert als abgeschlossen + archiviert
- ✅ pushToEnd verschiebt Task ans Ende der Woche
- ✅ report liefert Kategorien-Statistiken
- ✅ when zeigt Position eines Tasks in der Warteschlange

### Technisch
- ✅ Nur 2 NPM Dependencies (azure/storage-blob + gray-matter)
- ✅ Eine JavaScript-Datei für komplette Logik
- ✅ API Response < 500ms
- ✅ Europäisches Datumsformat durchgängig
- ✅ Markdown-Tabellen korrekt formatiert

### Sicherheit
- ✅ API-Key Authentifizierung funktional
- ✅ Input Validation für alle Actions
- ✅ Error Handling ohne Daten-Leaks

## Risiken & Mitigation

### Single File Complexity
**Risiko**: Eine Datei wird unübersichtlich  
**Mitigation**: Klare Funktions-Trennung und Kommentierung

### Markdown Parse Performance
**Risiko**: Große Dateien können langsam werden  
**Mitigation**: Wochenweise Trennung begrenzt Dateigröße

### Blob Storage Latency
**Risiko**: Network Calls können langsam sein  
**Mitigation**: Effiziente Read/Write Operationen

## Nächste Schritte

Nach Abschluss von Phase 1:
1. **Phase 2**: Frontend Integration und UI Anpassung
2. **Testing**: Comprehensive API Testing
3. **Deployment**: Azure Functions Deployment
4. **Monitoring**: Basic Logging und Error Tracking

---

**Geschätzter Gesamtaufwand**: 8 Stunden  
**Dauer**: 1 Arbeitstag  
**Komplexitätsreduktion**: 90% weniger Code als ursprünglich geplant