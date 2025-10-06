[
  {
    "filename": "arc42.md",
    "content": "# CodexMiroir - Architektur Dokumentation\n\n**Über arc42**\n\narc42, das Template zur Dokumentation von Software- und\nSystemarchitekturen.\n\nTemplate Version 8.2 DE. (basiert auf AsciiDoc Version), Januar 2023\n\nCreated, maintained and © by Dr. Peter Hruschka, Dr. Gernot Starke and\ncontributors. Siehe <https://arc42.org>.\n\n# Einführung und Ziele\n\n## Aufgabenstellung\n\nCodexMiroir ist ein minimalistisches Task-Management-System nach dem **Spartarégime-Prinzip**.\n\n### Kernprinzipien:\n- **Keine Prio, kein Snooze, keine fancy Felder**: Nur nummerierte Markdown-Dateien (0000.md - 9999.md)\n- **Dateiname = Reihenfolge**: Niedrigere Nummern werden zuerst eingeplant\n- **Timeline-basierte Verwaltung**: Automatische Slot-Zuweisung nach Regelwerk\n- **Git-basiert**: Tasks leben in GitHub Repository, Sync zu Azure Blob Storage\n- **Read-Only Rendering**: Azure Function rendert Timeline aus gecachten Daten\n\n### Funktionale Anforderungen:\n- Task-Verwaltung über Git (Markdown-Dateien in GitHub)\n- Automatischer Sync von GitHub zu Azure Blob Storage\n- Timeline-Rendering (JSON/HTML) mit Caching\n- Deterministische Auto-Fill-Logik (Fixed first, dann nach Dateinamen)\n- Kategorie-basierte Planung (geschäftlich = Mo-Fr, privat = Sa-So)\n- GitHub Webhook-Integration für automatischen Sync\n- ETag-basiertes HTTP Caching (basierend auf Git HEAD SHA)\n\n## Qualitätsziele\n\n| Priorität | Qualitätsziel | Szenario |\n|-----------|---------------|----------|\n| 1 | **Einfachheit** | Klare API-Struktur, minimales Frontend für Task-Verwaltung |\n| 2 | **Performance** | API-Response-Zeiten < 500ms für CRUD-Operationen |\n| 3 | **Verfügbarkeit** | Azure Functions Skalierung, Cosmos DB SLA 99.99% |\n| 4 | **Erweiterbarkeit** | Modulare Architektur mit einzelnen Azure Functions |\n| 5 | **Sicherheit** | Master Key Authentication, User-ID basierte Datentrennung |\n| 6 | **Wartbarkeit** | ES Modules, klare Trennung der Verantwortlichkeiten |\n\n## Stakeholder\n\n| Rolle | Kontakt | Erwartungshaltung |\n|-------|---------|-------------------|\n| **Einzelnutzer** | Endbenutzer | Einfache, fokussierte Task-Verwaltung ohne Ablenkung |\n| **Entwickler** | merlinbecker | Wartbare, erweiterbare Codebase mit Clean Code Prinzipien |\n| **Azure-Operator** | DevOps | Kostengünstige, skalierbare Azure Functions Deployment |\n\n# Randbedingungen\n\n## Technische Randbedingungen\n\n- **Plattform**: Azure Functions v4 mit Node.js 18+ (ES Modules)\n- **Datenspeicher**: Azure Blob Storage für Cache, GitHub als Source of Truth\n- **Frontend**: Statische Web-UI (Vanilla JavaScript mit Alpine.js)\n- **Sync**: GitHub API + Webhook für automatischen Pull\n- **Authentifizierung**: GitHub Webhook Secret, Azure Functions Function Keys\n\n## Organisatorische Randbedingungen\n\n- **Team**: Ein Entwickler (merlinbecker)\n- **Budget**: Kostengünstige Azure-Services (Pay-as-you-use)\n- **Zeitrahmen**: Iterative Entwicklung in 3 Phasen\n- **Dokumentation**: Deutsche Sprache, arc42-Standard\n\n## Konventionen\n\n- **Datumsformat**: ISO 8601 (YYYY-MM-DD) für API-Kommunikation\n- **Zeitslots**: AM (Vormittag), PM (Nachmittag), EV (Abend)\n- **Sprache**: Englische Codebase, deutsche Fehlermeldungen optional\n- **Code**: ES Modules, async/await Pattern\n\n# Kontextabgrenzung\n\n## Fachlicher Kontext\n\n```mermaid\nC4Context\n    title Fachlicher Kontext - CodexMiroir\n\n    Person(user, \"Benutzer\", \"Verwaltet Aufgaben über Web-Interface\")\n\n    System(codexmiroir, \"CodexMiroir\", \"Timeline-basiertes Task-Management System\")\n\n    System_Ext(azure_cosmos, \"Azure Cosmos DB\", \"Task- und Timeline-Speicher\")\n\n    Rel(user, codexmiroir, \"Verwaltet Tasks\", \"HTTPS/Web-UI\")\n    Rel(codexmiroir, azure_cosmos, \"Liest/Schreibt Tasks & Timeline\", \"Cosmos SDK\")\n```\n\n**Externe fachliche Schnittstellen:**\n\n- **Nutzer → CodexMiroir**: Task-Management über Web-Interface\n- **CodexMiroir → Azure Cosmos DB**: Persistierung von Tasks und Timeline-Daten\n\n## Technischer Kontext\n\n```mermaid\nC4Context\n    title Technischer Kontext - CodexMiroir\n\n    Person(user, \"User Browser\", \"Web Client\")\n\n    System_Boundary(azure, \"Azure Functions App\") {\n        Container(api, \"API Functions\", \"Node.js\", \"Task & Timeline Management API\")\n        Container(static, \"Static Server\", \"Node.js\", \"Test-UI Delivery\")\n    }\n\n    System_Ext(cosmos, \"Azure Cosmos DB\", \"Database: codexmiroir\")\n\n    Rel(user, static, \"GET /\", \"HTTPS\")\n    Rel(user, api, \"API Calls\", \"HTTPS/JSON + Master Key\")\n    Rel(api, cosmos, \"CRUD Operations\", \"@azure/cosmos SDK\")\n```\n\n**Technische Schnittstellen:**\n\n| Schnittstelle | Protokoll | Format | Beschreibung |\n|---------------|-----------|---------|--------------|\n| **Web-UI → Static Server** | HTTPS | HTML/CSS/JS | Auslieferung der Test-UI |\n| **Web-UI → API Functions** | HTTPS | JSON | Task- und Timeline-Management |\n| **API → Cosmos DB** | Cosmos SDK | JSON | Datenpersistierung |\n\n**Sicherheitsmodell:**\n- Alle API-Endpoints (`/api/*`) benötigen Azure Functions Master Key (`authLevel: \"admin\"`)\n- Master Key wird als Query-Parameter übergeben: `?code=MASTER_KEY`\n- Frontend extrahiert Key automatisch aus URL und fügt ihn allen API-Aufrufen hinzu\n- User-ID im Pfad sorgt für Datentrennung: `/api/tasks/{userId}`\n\n# Lösungsstrategie\n\nDie Architektur folgt dem **Azure Functions v4 Programming Model** mit klarer Trennung einzelner HTTP-Funktionen:\n\n## Strategische Entscheidungen\n\n1. **Azure Functions v4**: Serverless Microservices-Architektur\n   - *Begründung*: Kosteneffizienz, automatische Skalierung, einfaches Deployment\n\n2. **Cosmos DB als Datenbank**: NoSQL-Datenbank statt Blob Storage\n   - *Begründung*: Query-Fähigkeit, ACID-Transaktionen, Stored Procedures für komplexe Logik\n\n3. **User-ID im Pfad**: RESTful API-Design mit User-ID als Pfad-Parameter\n   - *Begründung*: Klare Datentrennung, intuitive API-Struktur\n\n4. **ES Modules**: Moderne JavaScript-Module\n   - *Begründung*: Zukunftssicher, bessere IDE-Unterstützung, klare Imports\n\n5. **Stored Procedures**: Cosmos DB Stored Procedures für Business-Logik\n   - *Begründung*: Atomare Operationen, konsistente Regelanwendung, Performance\n\n6. **Master Key Authentication**: Azure Functions eingebautes Auth-System\n   - *Begründung*: Keine zusätzliche Implementierung nötig, bewährte Sicherheit\n\n## Technologie-Stack\n\n- **Runtime**: Node.js 18+ auf Azure Functions v4\n- **Storage**: Azure Blob Storage (Cache), GitHub (Source of Truth)\n- **Frontend**: Statisches HTML/CSS/JS (kein Framework)\n- **Sync**: GitHub API + Webhook\n- **Deployment**: Azure Functions Core Tools\n\n# Bausteinsicht\n\n## Whitebox Gesamtsystem\n\n```mermaid\nC4Container\n    title Container Diagramm - CodexMiroir System\n\n    Person(user, \"Nutzer\", \"Task-Manager\")\n\n    System_Boundary(functions, \"Azure Functions App\") {\n        Container(api, \"Sync & Render\", \"Node.js\", \"GitHub Sync, Timeline Build\")\n        Container(static_srv, \"Static Server\", \"Node.js\", \"Serviert Timeline HTML\")\n    }\n\n    System_Ext(github, \"GitHub Repository\", \"Git\", \"Markdown Tasks (Source of Truth)\")\n    ContainerDb(blob, \"Azure Blob Storage\", \"Cache\", \"Timeline Artifacts & Raw Tasks\")\n\n    Rel(user, static_srv, \"Lädt Timeline\", \"Browser/HTTPS\")\n    Rel(github, api, \"Webhook Push\", \"HTTPS\")\n    Rel(api, github, \"Pull Tasks\", \"GitHub API\")\n    Rel(api, blob, \"Cache R/W\", \"Blob SDK\")\n```\n\n**Begründung:**\nDie Architektur trennt klar zwischen statischer UI-Auslieferung und API-Funktionalität. Alle Komponenten laufen in einer einzigen Azure Functions App für einfaches Deployment.\n\n**Enthaltene Bausteine:**\n\n### Sync & Render Functions\n- **Zweck**: GitHub Sync und Timeline-Berechnung\n- **Verantwortung**: Task-Sync von GitHub, Timeline-Build, Cache-Management\n- **Technologie**: Node.js mit Azure Functions v4, ES Modules\n\n### Web UI\n- **Zweck**: Benutzeroberfläche für Task-Verwaltung\n- **Verantwortung**: Timeline-Visualisierung, Task-Erstellung, API-Aufrufe\n- **Technologie**: Vanilla JavaScript, Alpine.js, PicoCSS\n\n### Static Server\n- **Zweck**: Auslieferung der Web-UI\n- **Verantwortung**: Serving von HTML/CSS/JS Assets\n- **Technologie**: Azure Function mit File System Access\n\n### Cosmos DB\n- **Zweck**: Persistente Datenhaltung\n- **Verantwortung**: Tasks Container, Timeline Container, Stored Procedures\n- **Technologie**: Azure Cosmos DB (NoSQL)\n\n## Ebene 2\n\n### Whitebox API Functions Container\n\n```mermaid\nC4Component\n    title Azure Functions - Interne Komponenten\n\n    Container_Boundary(functions, \"Azure Functions App\") {\n        Component(functions_js, \"functions.js\", \"Entry Point\", \"Registriert alle Functions\")\n        Component(storage, \"storage.js\", \"Blob Client\", \"Azure Blob Storage Access\")\n        Component(parsing, \"parsing.js\", \"Parser\", \"Markdown → Task Object\")\n        Component(sync, \"sync.js\", \"Sync Logic\", \"GitHub → Blob Sync\")\n\n        Component(github_webhook, \"githubWebhook.js\", \"HTTP Function\", \"POST /github/webhook\")\n        Component(manual_sync, \"manualSync.js\", \"HTTP Function\", \"GET/POST /sync\")\n        Component(render_codex, \"renderCodex.js\", \"HTTP Function\", \"GET /codex\")\n        Component(serve_static, \"serveStatic.js\", \"HTTP Function\", \"GET /{*path}\")\n    }\n\n    System_Ext(github_api, \"GitHub API\", \"REST\", \"Pull Task-Dateien\")\n    ContainerDb(blob_storage, \"Azure Blob Storage\", \"Cache\", \"raw/tasks/, artifacts/\")\n\n    Rel(functions_js, github_webhook, \"imports\", \"ES Module\")\n    Rel(functions_js, render_codex, \"imports\", \"ES Module\")\n\n    Rel(github_webhook, sync, \"triggers\", \"Function Call\")\n    Rel(manual_sync, sync, \"triggers\", \"Function Call\")\n    Rel(sync, github_api, \"pulls\", \"GitHub API\")\n    Rel(sync, storage, \"writes\", \"Function Call\")\n\n    Rel(render_codex, storage, \"reads cache\", \"Function Call\")\n    Rel(render_codex, parsing, \"parses tasks\", \"Function Call\")\n\n    Rel(storage, blob_storage, \"R/W\", \"Blob SDK\")\n```\n\n**Komponenten-Beschreibung:**\n\n### Entry Point (functions.js)\n- **Zweck**: Zentrale Registration aller Azure Functions\n- **Schnittstellen**: Import aller Function-Module\n- **Ablageort**: `/src/functions.js`\n\n### Blob Storage Client (storage.js)\n- **Zweck**: Azure Blob Storage Zugriff\n- **Schnittstellen**: `list()`, `getTextBlob()`, `putTextBlob()`\n- **Leistungsmerkmale**: Async/Await, Error Handling\n- **Ablageort**: `/shared/storage.js`\n\n### Parsing Module (parsing.js)\n- **Zweck**: Markdown-Parsing mit gray-matter\n- **Schnittstellen**: `parseTask(mdText)`, `sortKey(dateStr, slot)`\n- **Qualitätsmerkmale**: Stateless, Pure Functions\n- **Ablageort**: `/shared/parsing.js`\n\n### Sync Module (sync.js)\n- **Zweck**: GitHub → Blob Storage Synchronisation\n- **Schnittstellen**: `fullSync(ref, clean)`, `applyDiff(paths, ref)`\n- **Ablageort**: `/shared/sync.js`\n\n### HTTP Functions\nAlle mit `authLevel: \"function\"` (Function Key erforderlich):\n\n- **githubWebhook.js**: POST `/github/webhook` - GitHub Webhook Handler\n- **manualSync.js**: GET/POST `/sync` - Manueller Sync Trigger\n- **renderCodex.js**: GET `/codex` - Timeline Rendering (JSON/HTML)\n\n### Static Server (serveStatic.js)\n- **Zweck**: Auslieferung der Web-UI (`/public/`)\n- **Authentifizierung**: `authLevel: \"anonymous\"` (öffentlich zugänglich)\n- **Route**: `GET /{*path}` (Catch-All)\n- **Ablageort**: `/src/serveStatic.js`\n\n# Laufzeitsicht\n\n## Task Creation Scenario\n\n```mermaid\nsequenceDiagram\n    participant U as User (Web-UI)\n    participant A as createTask Function\n    participant H as Helpers Module\n    participant C as Cosmos DB Client\n    participant DB as Cosmos DB (tasks)\n\n    U->>A: POST /api/tasks/{userId}?code=MASTER_KEY\n    note over U,A: Body: {\"kind\": \"business\", \"title\": \"Meeting vorbereiten\"}\n\n    A->>A: Extract userId from path\n    A->>H: validateParams(userId, kind)\n    H-->>A: Validation OK\n\n    A->>C: cosmos()\n    C-->>A: { tasks container }\n\n    A->>A: Build task document\n    note over A: type: \"task\", userId, kind, title, status: \"open\"\n\n    A->>DB: tasks.items.create(task)\n    DB-->>A: { resource with generated id }\n\n    A-->>U: 201 Created + JSON response\n    note over A,U: { id, userId, kind, title, status, createdAt, ... }\n```\n\n## Timeline Retrieval Scenario\n\n```mermaid\nsequenceDiagram\n    participant U as User (Web-UI)\n    participant A as getTimeline Function\n    participant H as Helpers Module\n    participant C as Cosmos DB Client\n    participant TL as Cosmos DB (timeline)\n    participant T as Cosmos DB (tasks)\n\n    U->>A: GET /api/timeline/{userId}?dateFrom=2025-10-02&dateTo=2025-10-09&code=KEY\n\n    A->>A: Extract userId, dateFrom, dateTo\n    A->>H: validateParams(userId)\n    H-->>A: Validation OK\n\n    A->>C: cosmos()\n    C-->>A: { timeline, tasks }\n\n    A->>TL: Query: SELECT * WHERE type='day' AND date BETWEEN ...\n    TL-->>A: Day documents with slots\n\n    A->>A: Extract all taskIds from slots\n\n    A->>T: Query: SELECT id, title WHERE id IN (taskIds)\n    T-->>A: Task details\n\n    A->>A: Enrich timeline with task titles\n\n    A-->>U: 200 OK + Timeline JSON\n    note over A,U: { days: [{ date, slots: [{ assignment: { taskId, taskTitle } }] }] }\n```\n\n## AutoFill Scenario\n\n```mermaid\nsequenceDiagram\n    participant U as User (Web-UI)\n    participant A as autoFill Function\n    participant E as ensureDays Module\n    participant C as Cosmos DB Client\n    participant TL as Cosmos DB (timeline)\n    participant SP as Stored Procedure\n\n    U->>A: POST /api/timeline/{userId}/autofill?code=KEY\n    note over U,A: Body: {\"dateFrom\": \"2025-10-02\", \"task\": {\"id\": \"task_123\", \"kind\": \"business\"}}\n\n    A->>A: Extract userId, dateFrom, task\n    A->>A: Calculate searchUntilDate (+30 days)\n\n    A->>E: ensureDaysUpTo(userId, searchUntilDate)\n    E->>TL: Check existing days\n    TL-->>E: Latest day found\n    E->>TL: Create missing day documents\n    E-->>A: Days created\n\n    A->>C: cosmos()\n    C-->>A: { timeline }\n\n    A->>SP: Execute assignTaskToFirstFreeSlot(userId, dateFrom, task)\n    note over SP: Stored Procedure Logic:<br/>- Find first free slot<br/>- Respect business/personal rules<br/>- Atomic assignment\n\n    SP->>TL: Update day document with assignment\n    TL-->>SP: Success\n\n    SP-->>A: { assignedSlot, date, slotIdx }\n\n    A-->>U: 200 OK + Assignment result\n```\n\n# Verteilungssicht\n\n## Infrastruktur Ebene 1\n\n```mermaid\nC4Deployment\n    title Deployment Diagramm - Azure Infrastructure\n\n    Deployment_Node(azure_region, \"Azure West Europe\") {\n        Deployment_Node(rg, \"Resource Group\") {\n            Deployment_Node(func_app, \"Function App\", \"Azure Functions v4\") {\n                Container(api_fns, \"API Functions\", \"Node.js 18+\", \"9 HTTP Endpoints\")  \n                Container(static_fn, \"serveStatic\", \"Node.js\", \"UI Delivery\")\n            }\n            Deployment_Node(cosmos_acc, \"Cosmos DB Account\", \"NoSQL\") {\n                ContainerDb(tasks_container, \"tasks\", \"Container\", \"Task Documents\")\n                ContainerDb(timeline_container, \"timeline\", \"Container\", \"Day Documents + Stored Procedures\")\n            }\n        }\n    }\n\n    Deployment_Node(user_device, \"User Device\") {\n        Container(browser, \"Browser\", \"Web Client\", \"Test-UI\")\n    }\n\n    Rel(browser, func_app, \"HTTPS Requests\", \"Internet\")\n    Rel(func_app, cosmos_acc, \"Cosmos SDK\", \"Internal Network\")\n```\n\n**Begründung:**\nSingle Azure Functions App hostet alle API-Endpoints und die statische UI. Cosmos DB bietet zwei Container für Tasks und Timeline mit unterschiedlichen Datenstrukturen.\n\n**Qualitäts- und Leistungsmerkmale:**\n- **Verfügbarkeit**: 99.95% SLA durch Azure Functions, 99.99% SLA durch Cosmos DB\n- **Skalierbarkeit**: Automatische Skalierung basierend auf Request-Load\n- **Latenz**: <500ms durch europäischen Azure-Standort\n- **Kosten**: Pay-per-execution Model für niedrige Betriebskosten\n\n**Zuordnung von Bausteinen zu Infrastruktur:**\n\n| Baustein | Azure Service | Begründung |\n|----------|---------------|------------|\n| API Functions | Azure Functions (Node.js 18+) | Serverless, automatische Skalierung, ES Modules Support |\n| Web UI | Azure Functions (Static File Serving) | Unified Deployment, kein separates Hosting nötig |\n| Task Storage | Cosmos DB Container (tasks) | JSON-Dokumente mit Query-Fähigkeit |\n| Timeline Storage | Cosmos DB Container (timeline) | Day-Dokumente mit Stored Procedures |\n\n## Deployment-Prozess\n\n### Lokale Entwicklung\n```bash\n# Dependencies installieren\nnpm install\n\n# Cosmos DB Connection String in local.settings.json konfigurieren\n# Function App starten\nnpm start\n\n# Browser öffnen: http://localhost:7071/\n```\n\n### Azure Deployment\n```bash\n# Function App deployen\nfunc azure functionapp publish <function-app-name>\n\n# Environment Variables in Azure Portal konfigurieren:\n# - COSMOS_CONNECTION_STRING\n# - COSMOS_DB=codexmiroir\n# - COSMOS_TIMELINE=timeline\n# - COSMOS_TASKS=tasks\n# - DAY_HORIZON=30\n\n# Stored Procedures deployen\nnpm run deploy:sprocs\n\n# Master Key abrufen und URL teilen:\n# https://<app>.azurewebsites.net/?code=<master-key>\n```\n\n# Querschnittliche Konzepte\n\n## Authentication & Authorization\n\n**Azure Functions Master Key Authentication:**\n- Alle API-Endpoints (`/api/*`) benötigen `authLevel: \"admin\"`\n- Master Key wird als Query-Parameter übergeben: `?code=MASTER_KEY`\n- Frontend extrahiert Key automatisch aus URL und speichert ihn in einer Variable\n- Static Server (`serveStatic`) nutzt `authLevel: \"anonymous\"` für öffentlichen Zugriff\n- Key-Management: Master Key über Azure Portal abrufbar, Key-Rotation möglich\n\n**User-ID basierte Datentrennung:**\n- User-ID im URL-Pfad: `/api/tasks/{userId}`\n- Cosmos DB Queries filtern immer nach `userId`\n- Keine Cross-User-Zugriffe möglich\n- User-ID wird im Frontend im localStorage gespeichert\n\n## Datenformat & Persistierung\n\n**Cosmos DB JSON-Dokumente:**\n\nTask-Dokument:\n```json\n{\n  \"id\": \"task_<timestamp>_<uuid>\",\n  \"type\": \"task\",\n  \"userId\": \"u_merlin\",\n  \"kind\": \"business|personal\",\n  \"title\": \"Task Beschreibung\",\n  \"status\": \"open|in_progress|completed\",\n  \"tags\": [\"tag1\", \"tag2\"],\n  \"createdAt\": \"2025-10-02T10:30:00.000Z\",\n  \"updatedAt\": \"2025-10-02T10:30:00.000Z\"\n}\n```\n\nDay-Dokument (Timeline):\n```json\n{\n  \"id\": \"2025-10-02\",\n  \"type\": \"day\",\n  \"userId\": \"u_merlin\",\n  \"date\": \"2025-10-02\",\n  \"weekday\": 3,\n  \"tz\": \"Europe/Berlin\",\n  \"slots\": [\n    {\n      \"idx\": 0,\n      \"label\": \"AM\",\n      \"locked\": false,\n      \"manualOnly\": false,\n      \"assignment\": {\n        \"taskId\": \"task_123\",\n        \"kind\": \"business\",\n        \"source\": \"auto\",\n        \"taskTitle\": \"Meeting vorbereiten\"\n      }\n    }\n  ],\n  \"meta\": { \"autoFillEnabled\": true, \"notes\": [] }\n}\n```\n\n## Error Handling & Logging\n\n**Mehrstufige Fehlerbehandlung:**\n1. **Input Validation**: `validateParams()` prüft erforderliche Parameter\n2. **Business Logic Errors**: Try-Catch Blöcke in jeder Function\n3. **Standardized Error Response**: `errorResponse()` erzeugt einheitliche JSON-Fehler\n4. **Cosmos DB Errors**: Spezielle Behandlung von 404 (Not Found), 409 (Conflict)\n\n**Error Response Format:**\n```json\n{\n  \"error\": \"Error message\",\n  \"errorType\": \"ErrorClassName\",\n  \"errorCode\": 404\n}\n```\n\n**Logging-Konzept:**\n- Azure Functions Context Logger (`ctx.log()`)\n- Performance-Metriken automatisch durch Azure erfasst\n- Debug-Logs mit `ctx.log.warn()` für Warnings\n- Error-Tracking mit Stack-Traces via `ctx.log.error()`\n\n## Stored Procedures\n\n**Cosmos DB Stored Procedures für atomare Operationen:**\n\n### assignTaskToFirstFreeSlot\n- **Zweck**: Findet ersten freien Slot und weist Task zu\n- **Logik**: \n  - Iteriert durch Days ab `dateFrom`\n  - Prüft Slot-Verfügbarkeit (nicht locked, nicht belegt)\n  - Respektiert Business-Regeln (Mo-Fr für business)\n  - Atomare Update-Operation\n- **Return**: `{ success: true, date, slotIdx }`\n\n### assignTaskToSpecificSlot\n- **Zweck**: Weist Task einem spezifischen Slot zu\n- **Validierung**: Slot darf nicht locked oder belegt sein\n- **Return**: Aktualisiertes Day-Dokument\n\n## Day Management\n\n**Automatische Day-Dokument-Erstellung:**\n- `ensureDaysUpTo()` stellt sicher, dass Days bis Ziel-Datum existieren\n- Maximaler Vorlauf: 7 Tage ab heute (konfigurierbar)\n- Slots werden mit Default-Werten initialisiert\n- AM/PM Slots unlocked, EV (Abend) Slot manualOnly\n- Heutige Slots können automatisch locked werden (basierend auf aktueller Uhrzeit)\n\n## Frontend Integration\n\n**Relative Pfade & Key-Management:**\n- Frontend nutzt relative API-Pfade: `/api/tasks/{userId}`\n- Master Key wird aus URL extrahiert: `?code=KEY` oder `#code=KEY`\n- Key wird allen API-Aufrufen automatisch hinzugefügt\n- Username aus localStorage geladen oder bei erstem Besuch abgefragt\n- Keine Backend-URL-Konfiguration im Frontend erforderlich\n\n# Architekturentscheidungen\n\n## ADR-001: Azure Functions v4 mit einzelnen HTTP-Funktionen\n\n**Status**: Implementiert (Oktober 2024)\n\n**Kontext**: Migration von monolithischer Struktur zu einzelnen Azure Functions\n\n**Entscheidung**: Jeder API-Endpoint ist eine separate Azure Function\n\n**Begründung**:\n- ✅ Klare Verantwortlichkeiten (Single Responsibility Principle)\n- ✅ Einfacheres Testing einzelner Endpoints\n- ✅ Bessere Skalierung (Functions können unabhängig skalieren)\n- ✅ Einfachere Wartung und Erweiterung\n- ❌ Mehr Dateien (aber bessere Übersichtlichkeit)\n\n## ADR-002: Cosmos DB statt Blob Storage\n\n**Status**: Implementiert (Oktober 2024)\n\n**Kontext**: Ursprünglich Markdown-Dateien in Blob Storage geplant\n\n**Entscheidung**: Azure Cosmos DB mit JSON-Dokumenten\n\n**Begründung**:\n- ✅ Query-Fähigkeit (SQL-ähnliche Queries)\n- ✅ ACID-Transaktionen für konsistente Daten\n- ✅ Stored Procedures für komplexe Business-Logik\n- ✅ Bessere Performance für häufige Zugriffe\n- ✅ Einfachere Implementierung von AutoFill-Logik\n- ❌ Höhere Kosten als Blob Storage\n- ❌ Vendor Lock-in (aber Migration via JSON möglich)\n\n## ADR-003: User-ID im Pfad statt Header/ENV\n\n**Status**: Implementiert (Oktober 2024)\n\n**Kontext**: Multi-User-Support ohne komplexes Auth-System\n\n**Entscheidung**: User-ID als URL-Pfad-Parameter `/api/tasks/{userId}`\n\n**Begründung**:\n- ✅ RESTful API-Design\n- ✅ Klare Datentrennung\n- ✅ Intuitive API-Struktur\n- ✅ Einfach zu testen\n- ❌ User-ID sichtbar in URL (aber kein Security-Risk mit Master Key)\n\n## ADR-004: Master Key Authentication\n\n**Status**: Implementiert (Oktober 2024)\n\n**Kontext**: Bedarf für API-Sicherheit ohne komplexes OAuth2\n\n**Entscheidung**: Azure Functions eingebautes Master Key System\n\n**Begründung**:\n- ✅ Keine zusätzliche Implementierung nötig\n- ✅ Bewährtes System von Azure\n- ✅ Key-Rotation möglich\n- ✅ Einfache Integration im Frontend\n- ❌ Ein Key für alle User (aber akzeptabel für kleine Teams)\n- ❌ Key sichtbar in URL (HTTPS erforderlich)\n\n## ADR-005: Stored Procedures für AutoFill-Logik\n\n**Status**: Implementiert (Oktober 2024)\n\n**Kontext**: Komplexe Planungsregeln für automatische Task-Zuweisung\n\n**Entscheidung**: Cosmos DB Stored Procedures in JavaScript\n\n**Begründung**:\n- ✅ Atomare Operationen (keine Race Conditions)\n- ✅ Serverside Execution (weniger Netzwerk-Roundtrips)\n- ✅ Konsistente Regelanwendung\n- ✅ Performance-Vorteil\n- ❌ Schwieriger zu testen als Node.js Code\n- ❌ Separates Deployment nötig\n\n## ADR-006: ES Modules statt CommonJS\n\n**Status**: Implementiert (Oktober 2024)\n\n**Kontext**: Azure Functions v4 unterstützt ES Modules\n\n**Entscheidung**: `\"type\": \"module\"` in package.json\n\n**Begründung**:\n- ✅ Zukunftssicher (ES Modules sind Standard)\n- ✅ Bessere IDE-Unterstützung\n- ✅ Klare Import-Syntax\n- ✅ Tree-Shaking möglich\n- ❌ Manche npm-Pakete noch CommonJS-only\n\n# Qualitätsanforderungen\n\n## Qualitätsbaum\n\n```\nCodexMiroir Qualität\n├── Funktionalität\n│   ├── Task-Management (Hoch)\n│   │   ├── CRUD-Operationen\n│   │   └── Sprachsteuerung\n│   └── Offline-Fähigkeit (Mittel)\n├── Zuverlässigkeit  \n│   ├── Fehlertoleranz (Hoch)\n│   │   ├── Graceful Degradation\n│   │   └── Fallback-Mechanismen\n│   └── Wiederherstellbarkeit (Mittel)\n├── Benutzbarkeit\n│   ├── Einfachheit (Sehr Hoch)\n│   │   ├── Ein-Task-Fokus\n│   │   └── Minimale UI\n│   └── Deutscher Sprachsupport (Hoch)\n├── Effizienz\n│   ├── Antwortzeit (Hoch)\n│   │   └── <200ms API Calls\n│   └── Speicherverbrauch (Mittel)\n└── Wartbarkeit\n    ├── Modulare Architektur (Hoch)\n    ├── Clean Code (Hoch)\n    └── Testabdeckung (Mittel)\n```\n\n## Qualitätsszenarien\n\n### Szenario 1: Performance (Hoch)\n**Stimulus**: Nutzer erstellt neuen Task über Sprachkommando  \n**Response**: System verarbeitet Kommando und erstellt Task  \n**Measure**: Response-Zeit <200ms in 95% der Fälle\n\n### Szenario 2: Verfügbarkeit (Hoch)\n**Stimulus**: OpenAI API ist nicht erreichbar  \n**Response**: System fällt auf lokales Pattern-Matching zurück  \n**Measure**: Funktionalität bleibt zu 80% erhalten\n\n### Szenario 3: Benutzbarkeit (Sehr Hoch)\n**Stimulus**: Nutzer öffnet App  \n**Response**: Aktueller Task wird prominent angezeigt  \n**Measure**: Nur ein Task sichtbar, keine Ablenkungen\n\n### Szenario 4: Wartbarkeit (Hoch)\n**Stimulus**: Entwickler will neue Funktion hinzufügen  \n**Response**: Modulare Struktur ermöglicht einfache Erweiterung  \n**Measure**: Neue Features in <4 Stunden implementierbar\n\n### Szenario 5: Offline-Nutzung (Mittel)\n**Stimulus**: Nutzer verliert Internetverbindung  \n**Response**: PWA funktioniert mit gecachten Daten weiter  \n**Measure**: Grundfunktionen bleiben verfügbar\n\n# Risiken und technische Schulden\n\n## Identifizierte Risiken\n\n### Hohe Risiken\n\n**R1: Master Key Sicherheit** 🔴\n- **Beschreibung**: Ein einziger Master Key schützt alle API-Endpoints\n- **Auswirkung**: Kompromittierung des Keys ermöglicht vollen Zugriff\n- **Mitigation**: HTTPS erzwingen, Key-Rotation regelmäßig durchführen, Access-Logs überwachen\n- **Status**: 🔴 Akzeptiertes Risiko für kleine Teams, OAuth2 für größere Deployments empfohlen\n\n**R2: User-ID-Verlust führt zu Datenverlust**  \n- **Beschreibung**: User-IDs sind nur im Browser localStorage gespeichert\n- **Auswirkung**: Browser-Daten löschen → Zugriffsverlust auf alle Tasks\n- **Mitigation**: User-Aufklärung, Backup der User-ID empfehlen\n- **Status**: ⚠️ Aktuell nur durch User-Education mitigiert\n\n### Mittlere Risiken\n\n**R3: Azure Vendor Lock-in**\n- **Beschreibung**: Komplette Abhängigkeit von Azure Functions und Cosmos DB\n- **Auswirkung**: Migration zu anderen Cloud-Anbietern aufwändig\n- **Mitigation**: Cosmos DB JSON-Format ermöglicht Daten-Export, API-Logik portierbar\n- **Status**: 🔶 Akzeptiertes Risiko für Kosteneinsparungen\n\n**R4: Cosmos DB Kosten bei Skalierung**\n- **Beschreibung**: Cosmos DB RU-basierte Abrechnung kann bei hoher Last teuer werden\n- **Auswirkung**: Unerwartete Kosten bei vielen Usern\n- **Mitigation**: Request Units monitoring, ggf. Provisioned Throughput nutzen\n- **Status**: 🔶 Monitoring erforderlich\n\n**R5: Keine automatische Day-Erstellung über 7 Tage**\n- **Beschreibung**: Days werden nur maximal 7 Tage im Voraus erstellt\n- **Auswirkung**: Langfristige Planung (>1 Woche) erfordert manuelle Day-Erstellung\n- **Mitigation**: DAY_HORIZON Umgebungsvariable erhöhen möglich\n- **Status**: 🔶 Design-Entscheidung, kann bei Bedarf angepasst werden\n\n## Technische Schulden\n\n### Code-Qualität\n\n**TD1: Tests testen nicht den tatsächlichen Source Code** 🔴\n- **Problem**: Alle 99 Tests in `__tests__/` testen duplizierte Mock-Implementierungen\n- **Ist-Zustand**: 0% Coverage für /src/ Code trotz passing tests\n- **Auswirkung**: Keine echte Testabdeckung, Regressions werden nicht erkannt\n- **Priorität**: KRITISCH\n- **Status**: 🔴 Tests müssen refaktoriert werden um echten Code zu testen\n\n**TD2: Fehlende Eingabevalidierung für komplexe Felder** ⚠️\n- **Problem**: Grundlegende Validation vorhanden, aber nicht für alle Felder\n- **Beispiel**: Task-Tags, Datumsformat-Prüfung\n- **Auswirkung**: Mögliche Runtime-Errors bei malformed Requests\n- **Priorität**: Mittel\n- **Status**: ⚠️ Teilweise implementiert, Erweiterung geplant\n\n### Architektur\n\n**TD3: Stored Procedures Deployment nicht automatisiert** ⚠️\n- **Problem**: Stored Procedures müssen manuell deployed werden (`npm run deploy:sprocs`)\n- **Auswirkung**: Nach Cosmos DB Reset oder in neuen Environments vergessen Devs ggf. Deployment\n- **Priorität**: Mittel\n- **Vorschlag**: Integration in CI/CD Pipeline oder Startup-Check\n- **Status**: ⚠️ Manueller Prozess dokumentiert\n\n**TD4: Keine Rate Limiting** 🔶\n- **Problem**: Keine Request-Rate-Limitierung implementiert\n- **Auswirkung**: Potenzielle DoS-Anfälligkeit, hohe Cosmos DB Kosten\n- **Priorität**: Mittel\n- **Status**: 🔶 Azure Functions bietet eingebautes Throttling, aber keine User-spezifische Limits\n\n### Testing & Monitoring\n\n**TD5: Fehlendes Application Monitoring** 🔶\n- **Problem**: Keine Business-Metriken (Task-Erstellungsrate, AutoFill-Erfolgsquote, etc.)\n- **Auswirkung**: Keine Insights über Nutzerverhalten und System-Performance\n- **Status**: 🔶 Azure Application Insights vorhanden, Custom Metrics fehlen\n\n**TD6: Keine End-to-End Tests** ⚠️\n- **Problem**: Nur Unit-Tests vorhanden, keine Integration/E2E Tests\n- **Auswirkung**: API-Endpunkte und Cosmos DB Integration nicht automatisch getestet\n- **Priorität**: Mittel\n- **Status**: ⚠️ Manuelle Tests dokumentiert in TESTING_GUIDE.md\n\n### Dokumentation\n\n**TD7: Mehrere README-Dateien mit Überschneidungen** ⚠️\n- **Problem**: README.md, FUNCTION_APP_README.md, QUICK_START.md enthalten teilweise redundante Informationen\n- **Auswirkung**: Inkonsistenzen möglich, Wartungsaufwand\n- **Priorität**: Niedrig\n- **Status**: ⚠️ Konsolidierung in arc42.md geplant (diese Aufgabe)\n\n## Veraltete/Redundante Komponenten\n\n**Bereinigte Dateien (Oktober 2024):** ✅\n- `client/` - React Frontend Quellen - Entfernt\n- `server/` - Express Server - Entfernt\n- `/codex/` - Alte API-Struktur - Entfernt\n- `/frontend/` - Alte Frontend-Struktur - Entfernt\n- `/static/` - Altes Static Files Verzeichnis - Entfernt\n- `manifest.json`, `sw.js` - PWA Dateien (nie implementiert) - Entfernt\n- Migration-Scripts für PostgreSQL - Entfernt\n- `results/` - Alte Refactoring Reports - Entfernt\n- `attached_assets/` - Temporäre Issue-Dateien - Entfernt\n\n**Noch vorhandene Dateien (sollten bereinigt werden):** ⚠️\n- `codequality/report.md` - Generierte Code Quality Reports - Sollte entfernt oder .gitignored werden\n\n**Status**: 🟢 Codebase aufgeräumt, aktuelle Architektur klar implementiert\n\n# Betrieb und Deployment\n\n## Voraussetzungen\n\n### Für lokale Entwicklung:\n- **Node.js** 18+ (LTS empfohlen)\n- **Azure Functions Core Tools v4** (`npm install -g azure-functions-core-tools@4`)\n- **Azure Blob Storage** (oder lokaler Azurite Emulator)\n- **Git** zum Klonen des Repository\n- **GitHub Token** mit Repo-Zugriff\n\n### Für Azure-Deployment:\n- Azure Account mit aktiver Subscription\n- Azure Function App (erstellt in Azure Portal)\n- Azure Blob Storage Account\n- GitHub Repository mit Tasks\n- Azure CLI (optional, für Deployment-Automatisierung)\n\n## Lokale Entwicklung einrichten\n\n### 1. Repository klonen und Dependencies installieren\n```bash\ngit clone https://github.com/merlinbecker/CodexMiroir.git\ncd CodexMiroir\nnpm install\n```\n\n### 2. Azure Blob Storage konfigurieren\n\nErstelle `local.settings.json` im Root-Verzeichnis:\n```json\n{\n  \"IsEncrypted\": false,\n  \"Values\": {\n    \"AzureWebJobsStorage\": \"UseDevelopmentStorage=true\",\n    \"FUNCTIONS_WORKER_RUNTIME\": \"node\",\n    \"GITHUB_TOKEN\": \"<your-github-token>\",\n    \"GITHUB_OWNER\": \"merlinbecker\",\n    \"GITHUB_REPO\": \"CodexMiroir\",\n    \"CACHE_CONTAINER_NAME\": \"codexmiroir-cache\"\n  }\n}\n```\n\n**Wichtig**: Ersetze Platzhalter mit deinen echten Werten. Bei lokaler Entwicklung ohne Azure-Speicher kann `UseDevelopmentStorage=true` verwendet werden.\n\n### 3. Cache Container erstellen (falls nötig)\n\nWenn Azurite oder ein lokaler Blob Storage Emulator verwendet wird, wird der Container normalerweise automatisch erstellt. Bei Azure Blob Storage muss der Container manuell angelegt werden.\n\n### 4. Function App starten\n\n```bash\nnpm start\n# oder\nfunc start\n```\n\nBrowser öffnen: `http://localhost:7071/`\n\n**Hinweis**: Bei lokaler Entwicklung wird der Master Key ignoriert. Username wird beim ersten Öffnen abgefragt.\n\n## Azure Deployment\n\n### 1. Function App erstellen\n\nVia Azure Portal oder CLI:\n```bash\naz functionapp create \\\n  --name <your-function-app-name> \\\n  --resource-group <your-resource-group> \\\n  --consumption-plan-location westeurope \\\n  --runtime node \\\n  --runtime-version 18 \\\n  --functions-version 4 \\\n  --storage-account <your-storage-account-name> \\\n  --assign-identity [system] \\\n  --scope user\n```\n\n### 2. Environment Variables konfigurieren\n\nIn Azure Portal unter \"Configuration\" → \"Application settings\":\n```\nGITHUB_TOKEN = <your-github-token>\nGITHUB_OWNER = merlinbecker\nGITHUB_REPO = CodexMiroir\nCACHE_CONTAINER_NAME = codexmiroir-cache\n```\n\n### 3. Function App deployen\n\n```bash\nfunc azure functionapp publish <your-function-app-name>\n```\n\n### 4. GitHub Integration einrichten\n\n- **Webhook**: Erstelle einen Webhook in deinem GitHub Repository, der auf `push` Events reagiert und auf die URL deiner Azure Function zeigt (z.B. `https://<your-app>.azurewebsites.net/api/github/webhook`).\n- **Secret**: Verwende ein starkes Secret für den Webhook.\n\n### 5. Master Key abrufen und URL teilen\n\n```bash\naz functionapp keys list \\\n  --name <your-function-app-name> \\\n  --resource-group <your-resource-group>\n```\n\nApp-URL mit Master Key:\n```\nhttps://<your-app>.azurewebsites.net/?code=<MASTER_KEY>\n```\n\n## Sicherheits-Setup\n\n### Master Key Management\n\n**Master Key Schutz:**\n- Master Key niemals in Git committen\n- HTTPS erzwingen (in Azure automatisch)\n- Key-Rotation bei Kompromittierung:\n  ```bash\n  az functionapp keys set \\\n    --name <app-name> \\\n    --resource-group <rg> \\\n    --key-type masterKey \\\n    --key-name master \\\n    --key-value <new-key>\n  ```\n\n**Frontend Key-Extraktion:**\n- Frontend extrahiert Key aus URL: `?code=KEY` oder `#code=KEY`\n- Key wird in JavaScript-Variable gespeichert (nicht localStorage für Sicherheit)\n- Key wird allen API-Aufrufen automatisch hinzugefügt\n\n**User-ID Management:**\n- Username wird beim ersten Besuch abgefragt\n- Gespeichert in `localStorage.getItem('codexmiroir_userId')`\n- User kann Username über UI ändern\n\n### Request Flow mit Security\n\n```\n1. User öffnet: https://app.azurewebsites.net/?code=MASTER_KEY\n\n2. Frontend (serveStatic, anonymous):\n   - Lädt index.html, app.js, styles.css\n   - JavaScript extrahiert Master Key aus URL\n   - JavaScript lädt Username aus localStorage\n\n3. API Call (z.B. createTask, admin):\n   POST /api/tasks/u_merlin?code=MASTER_KEY\n   - Azure Functions validiert Master Key\n   - ✅ Key korrekt → Request wird verarbeitet\n   - ❌ Key fehlt/falsch → 401 Unauthorized\n\n4. GitHub API Call (Sync):\n   - Authentifizierung über GITHUB_TOKEN\n\n5. Blob Storage Access:\n   - Authentifizierung über Azure Function Identity oder Connection String\n```\n\n## API-Endpoints Übersicht\n\nAlle API-Endpoints außer `serveStatic` benötigen Master Key (`?code=KEY`):\n\n### Task Management\n- `POST /api/tasks/{userId}` - Task erstellen\n- `GET /api/tasks/{userId}/{taskId}` - Task abrufen\n- `PUT /api/tasks/{userId}/{taskId}` - Task aktualisieren\n- `DELETE /api/tasks/{userId}/{taskId}` - Task löschen\n\n### Timeline Management\n- `GET /api/codex/{userId}?dateFrom=...&dateTo=...` - Timeline abrufen\n- `POST /api/codex/{userId}/sync` - Manueller Sync Trigger\n\n### Frontend\n- `GET /{*path}` - Web-UI (öffentlich)\n\n## Troubleshooting\n\n### \"GITHUB_TOKEN not configured\" error\n→ GITHUB_TOKEN in `local.settings.json` oder Azure App Settings setzen\n\n### \"Blob container not found\" error\n→ CACHE_CONTAINER_NAME in `local.settings.json` oder Azure App Settings setzen, ggf. manuell erstellen\n\n### Sync errors\n→ GitHub Webhook Konfiguration prüfen, GitHub Token auf Repositories-Zugriff prüfen\n\n### Timer Function Warnung in lokaler Entwicklung\n→ Normal ohne Storage Emulator, HTTP-Endpoints funktionieren trotzdem\n\n## Migration von alten Versionen\n\nDie aktuelle Architektur (Oktober 2024) hat folgende Änderungen:\n\n### Von Cosmos DB zu Blob Storage\n- **Alt**: JSON-Dokumente in Azure Cosmos DB\n- **Neu**: Markdown-Dateien in Azure Blob Storage\n- **Migration**: Daten müssen manuell in Blob Storage importiert werden (oder neu erstellt werden)\n\n### Von /src/ zu /codex/\n- **Alt**: Einzelne Functions in `/src/` Verzeichnis\n- **Neu**: Modulare Struktur in `/codex/` Verzeichnis\n- **Breaking**: API-Pfade geändert von `/api/tasks/{userId}` zu `/api/codex/{userId}`\n\n### Von Pfad-Parameter zu ENV USER_ID\n- **Alt**: `req.params.userId` im Pfad\n- **Neu**: `process.env.USER_ID` (Single-User-Modell)\n- **Breaking**: Multi-User-Support entfernt\n\n**Status**: 🟢 Codebase aufgeräumt, aktuelle Architektur klar implementiert\n\n# Glossar\n\n| Begriff | Definition |\n|---------|------------|\n| **Timeline** | Zeitbasierte Ansicht mit Day-Dokumenten und Slots für Task-Planung |\n| **Day Document** | Azure Blob Storage Objekt, das einen Tag repräsentiert mit Slots und Meta-Informationen |\n| **Zeitslot** | Teil eines Tages für Task-Bearbeitung (AM: Vormittag, PM: Nachmittag, EV: Abend) |\n| **User-ID** | Eindeutige Benutzer-Kennung für Datentrennung (z.B. \"u_merlin\") |\n| **Master Key** | Azure Functions Admin-Key für API-Authentifizierung |\n| **Slot Assignment** | Zuweisung eines Tasks zu einem spezifischen Zeitslot |\n| **AutoFill** | Automatische Task-Planung durch Sync-Logik |\n| **Stored Procedure** | Serverside JavaScript-Funktion in Cosmos DB für atomare Operationen |\n| **Task Kind** | Aufgabentyp: \"business\" (beruflich) oder \"personal\" (privat) |\n| **Locked Slot** | Zeitslot der nicht für automatische Planung verfügbar ist |\n| **Manual Only** | Slot kann nur manuell, nicht durch AutoFill belegt werden |\n| **Day Horizon** | Anzahl Tage in die Zukunft für die Days automatisch erstellt werden |\n| **ES Modules** | ECMAScript Module-System (import/export statt require) |\n| **Azure Functions v4** | Neueste Version des Azure Serverless-Frameworks |\n| **Cosmos DB** | Azure NoSQL-Datenbank mit JSON-Dokumenten und SQL-ähnlichen Queries |\n| **Request Units (RU)** | Cosmos DB Performance-Maßeinheit für Abrechnung |\n| **authLevel** | Azure Functions Authentifizierungs-Level (admin, anonymous, function) |\n| **C4 Model** | Context, Containers, Components, Code - Architektur-Diagramm-Standard |\n| **arc42** | Standard-Template für Software-Architektur-Dokumentation |\n"
  }
]
```CodexMiroir Qualität
├── Funktionalität
│   ├── Task-Management (Hoch)
│   │   ├── CRUD-Operationen
│   │   └── Sprachsteuerung
│   └── Offline-Fähigkeit (Mittel)
├── Zuverlässigkeit  
│   ├── Fehlertoleranz (Hoch)
│   │   ├── Graceful Degradation
│   │   └── Fallback-Mechanismen
│   └── Wiederherstellbarkeit (Mittel)
├── Benutzbarkeit
│   ├── Einfachheit (Sehr Hoch)
│   │   ├── Ein-Task-Fokus
│   │   └── Minimale UI
│   └── Deutscher Sprachsupport (Hoch)
├── Effizienz
│   ├── Antwortzeit (Hoch)
│   │   └── <200ms API Calls
│   └── Speicherverbrauch (Mittel)
└── Wartbarkeit
    ├── Modulare Architektur (Hoch)
    ├── Clean Code (Hoch)
    └── Testabdeckung (Mittel)
```

## Qualitätsszenarien

### Szenario 1: Performance (Hoch)
**Stimulus**: Nutzer erstellt neuen Task über Sprachkommando  
**Response**: System verarbeitet Kommando und erstellt Task  
**Measure**: Response-Zeit <200ms in 95% der Fälle

### Szenario 2: Verfügbarkeit (Hoch)
**Stimulus**: OpenAI API ist nicht erreichbar  
**Response**: System fällt auf lokales Pattern-Matching zurück  
**Measure**: Funktionalität bleibt zu 80% erhalten

### Szenario 3: Benutzbarkeit (Sehr Hoch)
**Stimulus**: Nutzer öffnet App  
**Response**: Aktueller Task wird prominent angezeigt  
**Measure**: Nur ein Task sichtbar, keine Ablenkungen

### Szenario 4: Wartbarkeit (Hoch)
**Stimulus**: Entwickler will neue Funktion hinzufügen  
**Response**: Modulare Struktur ermöglicht einfache Erweiterung  
**Measure**: Neue Features in <4 Stunden implementierbar

### Szenario 5: Offline-Nutzung (Mittel)
**Stimulus**: Nutzer verliert Internetverbindung  
**Response**: PWA funktioniert mit gecachten Daten weiter  
**Measure**: Grundfunktionen bleiben verfügbar

# Risiken und technische Schulden

## Identifizierte Risiken

### Hohe Risiken

**R1: Master Key Sicherheit** 🔴
- **Beschreibung**: Ein einziger Master Key schützt alle API-Endpoints
- **Auswirkung**: Kompromittierung des Keys ermöglicht vollen Zugriff
- **Mitigation**: HTTPS erzwingen, Key-Rotation regelmäßig durchführen, Access-Logs überwachen
- **Status**: 🔴 Akzeptiertes Risiko für kleine Teams, OAuth2 für größere Deployments empfohlen

**R2: User-ID-Verlust führt zu Datenverlust**  
- **Beschreibung**: User-IDs sind nur im Browser localStorage gespeichert
- **Auswirkung**: Browser-Daten löschen → Zugriffsverlust auf alle Tasks
- **Mitigation**: User-Aufklärung, Backup der User-ID empfehlen
- **Status**: ⚠️ Aktuell nur durch User-Education mitigiert

### Mittlere Risiken

**R3: Azure Vendor Lock-in**
- **Beschreibung**: Komplette Abhängigkeit von Azure Functions und Cosmos DB
- **Auswirkung**: Migration zu anderen Cloud-Anbietern aufwändig
- **Mitigation**: Cosmos DB JSON-Format ermöglicht Daten-Export, API-Logik portierbar
- **Status**: 🔶 Akzeptiertes Risiko für Kosteneinsparungen

**R4: Cosmos DB Kosten bei Skalierung**
- **Beschreibung**: Cosmos DB RU-basierte Abrechnung kann bei hoher Last teuer werden
- **Auswirkung**: Unerwartete Kosten bei vielen Usern
- **Mitigation**: Request Units monitoring, ggf. Provisioned Throughput nutzen
- **Status**: 🔶 Monitoring erforderlich

**R5: Keine automatische Day-Erstellung über 7 Tage**
- **Beschreibung**: Days werden nur maximal 7 Tage im Voraus erstellt
- **Auswirkung**: Langfristige Planung (>1 Woche) erfordert manuelle Day-Erstellung
- **Mitigation**: DAY_HORIZON Umgebungsvariable erhöhen möglich
- **Status**: 🔶 Design-Entscheidung, kann bei Bedarf angepasst werden

## Technische Schulden

### Code-Qualität

**TD1: Tests testen nicht den tatsächlichen Source Code** 🔴
- **Problem**: Alle 99 Tests in `__tests__/` testen duplizierte Mock-Implementierungen
- **Ist-Zustand**: 0% Coverage für /src/ Code trotz passing tests
- **Auswirkung**: Keine echte Testabdeckung, Regressions werden nicht erkannt
- **Priorität**: KRITISCH
- **Status**: 🔴 Tests müssen refaktoriert werden um echten Code zu testen

**TD2: Fehlende Eingabevalidierung für komplexe Felder** ⚠️
- **Problem**: Grundlegende Validation vorhanden, aber nicht für alle Felder
- **Beispiel**: Task-Tags, Datumsformat-Prüfung
- **Auswirkung**: Mögliche Runtime-Errors bei malformed Requests
- **Priorität**: Mittel
- **Status**: ⚠️ Teilweise implementiert, Erweiterung geplant

### Architektur

**TD3: Stored Procedures Deployment nicht automatisiert** ⚠️
- **Problem**: Stored Procedures müssen manuell deployed werden (`npm run deploy:sprocs`)
- **Auswirkung**: Nach Cosmos DB Reset oder in neuen Environments vergessen Devs ggf. Deployment
- **Priorität**: Mittel
- **Vorschlag**: Integration in CI/CD Pipeline oder Startup-Check
- **Status**: ⚠️ Manueller Prozess dokumentiert

**TD4: Keine Rate Limiting** 🔶
- **Problem**: Keine Request-Rate-Limitierung implementiert
- **Auswirkung**: Potenzielle DoS-Anfälligkeit, hohe Cosmos DB Kosten
- **Priorität**: Mittel
- **Status**: 🔶 Azure Functions bietet eingebautes Throttling, aber keine User-spezifische Limits

### Testing & Monitoring

**TD5: Fehlendes Application Monitoring** 🔶
- **Problem**: Keine Business-Metriken (Task-Erstellungsrate, AutoFill-Erfolgsquote, etc.)
- **Auswirkung**: Keine Insights über Nutzerverhalten und System-Performance
- **Status**: 🔶 Azure Application Insights vorhanden, Custom Metrics fehlen

**TD6: Keine End-to-End Tests** ⚠️
- **Problem**: Nur Unit-Tests vorhanden, keine Integration/E2E Tests
- **Auswirkung**: API-Endpunkte und Cosmos DB Integration nicht automatisch getestet
- **Priorität**: Mittel
- **Status**: ⚠️ Manuelle Tests dokumentiert in TESTING_GUIDE.md

### Dokumentation

**TD7: Mehrere README-Dateien mit Überschneidungen** ⚠️
- **Problem**: README.md, FUNCTION_APP_README.md, QUICK_START.md enthalten teilweise redundante Informationen
- **Auswirkung**: Inkonsistenzen möglich, Wartungsaufwand
- **Priorität**: Niedrig
- **Status**: ⚠️ Konsolidierung in arc42.md geplant (diese Aufgabe)

## Veraltete/Redundante Komponenten

**Bereinigte Dateien (Oktober 2024):** ✅
- `client/` - React Frontend Quellen - Entfernt
- `server/` - Express Server - Entfernt
- `/codex/` - Alte API-Struktur - Entfernt
- `/frontend/` - Alte Frontend-Struktur - Entfernt
- `/static/` - Altes Static Files Verzeichnis - Entfernt
- `manifest.json`, `sw.js` - PWA Dateien (nie implementiert) - Entfernt
- Migration-Scripts für PostgreSQL - Entfernt
- `results/` - Alte Refactoring Reports - Entfernt
- `attached_assets/` - Temporäre Issue-Dateien - Entfernt

**Noch vorhandene Dateien (sollten bereinigt werden):** ⚠️
- `codequality/report.md` - Generierte Code Quality Reports - Sollte entfernt oder .gitignored werden

**Status**: 🟢 Codebase aufgeräumt, aktuelle Architektur klar implementiert

# Betrieb und Deployment

## Voraussetzungen

### Für lokale Entwicklung:
- **Node.js** 18+ (LTS empfohlen)
- **Azure Functions Core Tools v4** (`npm install -g azure-functions-core-tools@4`)
- **Azure Blob Storage** (oder lokaler Azurite Emulator)
- **Git** zum Klonen des Repository
- **GitHub Token** mit Repo-Zugriff

### Für Azure-Deployment:
- Azure Account mit aktiver Subscription
- Azure Function App (erstellt in Azure Portal)
- Azure Blob Storage Account
- GitHub Repository mit Tasks
- Azure CLI (optional, für Deployment-Automatisierung)

## Lokale Entwicklung einrichten

### 1. Repository klonen und Dependencies installieren
```bash
git clone https://github.com/merlinbecker/CodexMiroir.git
cd CodexMiroir
npm install
```

### 2. Azure Blob Storage konfigurieren

Erstelle `local.settings.json` im Root-Verzeichnis:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "GITHUB_TOKEN": "<your-github-token>",
    "GITHUB_OWNER": "merlinbecker",
    "GITHUB_REPO": "CodexMiroir",
    "CACHE_CONTAINER_NAME": "codexmiroir-cache"
  }
}
```

**Wichtig**: Ersetze Platzhalter mit deinen echten Werten. Bei lokaler Entwicklung ohne Azure-Speicher kann `UseDevelopmentStorage=true` verwendet werden.

### 3. Cache Container erstellen (falls nötig)

Wenn Azurite oder ein lokaler Blob Storage Emulator verwendet wird, wird der Container normalerweise automatisch erstellt. Bei Azure Blob Storage muss der Container manuell angelegt werden.

### 4. Function App starten

```bash
npm start
# oder
func start
```

Browser öffnen: `http://localhost:7071/`

**Hinweis**: Bei lokaler Entwicklung wird der Master Key ignoriert. Username wird beim ersten Öffnen abgefragt.

## Azure Deployment

### 1. Function App erstellen

Via Azure Portal oder CLI:
```bash
az functionapp create \
  --name <your-function-app-name> \
  --resource-group <your-resource-group> \
  --consumption-plan-location westeurope \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --storage-account <your-storage-account-name> \
  --assign-identity [system] \
  --scope user
```

### 2. Environment Variables konfigurieren

In Azure Portal unter "Configuration" → "Application settings":
```
GITHUB_TOKEN = <your-github-token>
GITHUB_OWNER = merlinbecker
GITHUB_REPO = CodexMiroir
CACHE_CONTAINER_NAME = codexmiroir-cache
```

### 3. Function App deployen

```bash
func azure functionapp publish <your-function-app-name>
```

### 4. GitHub Integration einrichten

- **Webhook**: Erstelle einen Webhook in deinem GitHub Repository, der auf `push` Events reagiert und auf die URL deiner Azure Function zeigt (z.B. `https://<your-app>.azurewebsites.net/api/github/webhook`).
- **Secret**: Verwende ein starkes Secret für den Webhook.

### 5. Master Key abrufen und URL teilen

```bash
az functionapp keys list \
  --name <your-function-app-name> \
  --resource-group <your-resource-group>
```

App-URL mit Master Key:
```
https://<your-app>.azurewebsites.net/?code=<MASTER_KEY>
```

## Sicherheits-Setup

### Master Key Management

**Master Key Schutz:**
- Master Key niemals in Git committen
- HTTPS erzwingen (in Azure automatisch)
- Key-Rotation bei Kompromittierung:
  ```bash
  az functionapp keys set \
    --name <app-name> \
    --resource-group <rg> \
    --key-type masterKey \
    --key-name master \
    --key-value <new-key>
  ```

**Frontend Key-Extraktion:**
- Frontend extrahiert Key aus URL: `?code=KEY` oder `#code=KEY`
- Key wird in JavaScript-Variable gespeichert (nicht localStorage für Sicherheit)
- Key wird allen API-Aufrufen automatisch hinzugefügt

**User-ID Management:**
- Username wird beim ersten Besuch abgefragt
- Gespeichert in `localStorage.getItem('codexmiroir_userId')`
- User kann Username über UI ändern

### Request Flow mit Security

```
1. User öffnet: https://app.azurewebsites.net/?code=MASTER_KEY

2. Frontend (serveStatic, anonymous):
   - Lädt index.html, app.js, styles.css
   - JavaScript extrahiert Master Key aus URL
   - JavaScript lädt Username aus localStorage

3. API Call (z.B. createTask, admin):
   POST /api/tasks/{userId}?code=MASTER_KEY
   - Azure Functions validiert Master Key
   - ✅ Key korrekt → Request wird verarbeitet
   - ❌ Key fehlt/falsch → 401 Unauthorized

4. GitHub API Call (Sync):
   - Authentifizierung über GITHUB_TOKEN

5. Blob Storage Access:
   - Authentifizierung über Azure Function Identity oder Connection String