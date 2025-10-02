# CodexMiroir

**CodexMiroir** ist ein intelligentes Task-Management-System, das als Azure Function App mit integriertem Frontend läuft. Die Anwendung verwaltet Aufgaben in einer Timeline und bietet automatische Planung basierend auf Zeitslots und Prioritäten.

## Was macht die App?

CodexMiroir ist ein umfassendes Task-Management-System mit folgenden Kernfunktionen:

- **Timeline-basierte Aufgabenverwaltung**: Aufgaben werden in Zeitslots (Vormittag/Nachmittag) geplant
- **Automatische Planung**: Tasks werden automatisch in passende freie Slots eingeplant
- **Manuelle Zuweisung**: Tasks können manuell zu bestimmten Zeitslots zugewiesen werden
- **Priorisierung**: Tasks können priorisiert werden (tauscht Position mit höchstpriorisiertem Task)
- **CRUD-Operationen**: Vollständige Verwaltung von Tasks (Erstellen, Lesen, Aktualisieren, Löschen)
- **Multi-User-Support**: Jeder Benutzer hat seine eigene Timeline und Task-Liste
- **Web-Interface**: Integrierte Test-UI für einfache Verwaltung

Die App nutzt **Azure Cosmos DB** für die Datenspeicherung und **Stored Procedures** für komplexe Planungslogik.

## Was braucht man, um die App laufen zu lassen?

### Voraussetzungen

#### Für lokale Entwicklung:
- **Node.js** 18+ (LTS empfohlen)
- **Azure Functions Core Tools v4** (`npm install -g azure-functions-core-tools@4`)
- **Azure Cosmos DB**:
  - Entweder ein Azure Cosmos DB Account
  - Oder lokaler Cosmos DB Emulator
- **Git** (zum Klonen des Repository)

#### Für Azure-Deployment:
- Azure Account mit aktiver Subscription
- Azure Function App (erstellt in Azure Portal)
- Azure Cosmos DB Account
- Azure CLI (optional, für Deployment-Automatisierung)

### Lokale Entwicklung einrichten

1. **Repository klonen**
   ```bash
   git clone https://github.com/merlinbecker/CodexMiroir.git
   cd CodexMiroir
   ```

2. **Dependencies installieren**
   ```bash
   npm install
   ```

3. **Cosmos DB konfigurieren**
   
   Erstelle die Datei `local.settings.json` im Root-Verzeichnis:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://<your-account>.documents.azure.com:443/;AccountKey=<your-key>;",
       "COSMOS_DB": "codexmiroir",
       "COSMOS_TIMELINE": "timeline",
       "COSMOS_TASKS": "tasks",
       "USERS_CSV": "u_merlin",
       "DAY_HORIZON": "30"
     }
   }
   ```

4. **Stored Procedures deployen** (einmalig erforderlich)
   ```bash
   npm run deploy:sprocs
   ```

5. **Function App starten**
   ```bash
   npm start
   ```

6. **Browser öffnen**
   ```
   http://localhost:7071/
   ```
   
   **Hinweis**: Bei lokaler Entwicklung wird der Function Key ignoriert. Du wirst beim ersten Öffnen nach einem Username gefragt (z.B. `u_merlin`).

### Azure Deployment

```bash
# Function App deployen
func azure functionapp publish your-function-app-name

# Umgebungsvariablen konfigurieren
az functionapp config appsettings set \
  --name your-function-app-name \
  --resource-group your-resource-group \
  --settings \
    "COSMOS_CONNECTION_STRING=your-cosmos-connection-string" \
    "COSMOS_DB=codexmiroir" \
    "COSMOS_TIMELINE=timeline" \
    "COSMOS_TASKS=tasks" \
    "USERS_CSV=u_merlin" \
    "DAY_HORIZON=30"

# Master Key abrufen
az functionapp keys list \
  --name your-function-app-name \
  --resource-group your-resource-group
```

**Nach dem Deployment**: Öffne die App mit dem Master Key:
```
https://your-function-app.azurewebsites.net/?code=YOUR_MASTER_KEY
```

Siehe auch: [SECURITY_SETUP.md](./documentation/SECURITY_SETUP.md) und [arc42.md](./documentation/arc42.md) für Details zur Architektur und Deployment.

## API-Routen und Funktionen im Detail

### 🔒 Sicherheit

**Alle API-Endpoints sind mit Master Key Authentication gesichert!**

- Alle `/api/*` Routen benötigen `authLevel: "admin"`
- Zugriff erfolgt über: `?code=YOUR_MASTER_KEY`
- Das Frontend extrahiert den Key automatisch aus der URL
- Die Test-UI unter `/` ist öffentlich zugänglich (anonymous)

---

### 📋 Timeline-Management

#### **GET** `/api/timeline/{userId}`
Ruft die Timeline für einen Benutzer ab.

**Query Parameter**:
- `dateFrom` (optional): Start-Datum im Format `YYYY-MM-DD`
- `dateTo` (optional): End-Datum im Format `YYYY-MM-DD`

**Beispiel**:
```bash
curl "http://localhost:7071/api/timeline/u_merlin?dateFrom=2025-10-02&dateTo=2025-10-09"
```

**Antwort**: Liste von Tagen mit Zeitslots und zugewiesenen Tasks

---

#### **POST** `/api/timeline/{userId}/assign`
Weist einen Task manuell einem bestimmten Zeitslot zu.

**Request Body**:
```json
{
  "date": "2025-10-02",
  "slotIdx": 0,
  "task": {
    "id": "task_123",
    "kind": "business",
    "title": "Meeting vorbereiten"
  },
  "source": "manual"
}
```

**Parameter**:
- `date`: Datum im Format `YYYY-MM-DD`
- `slotIdx`: Slot-Index (0 = Vormittag, 1 = Nachmittag)
- `task`: Task-Objekt mit `id`, `kind`, `title`
- `source`: `"manual"` oder `"auto"`

**Beispiel**:
```bash
curl -X POST http://localhost:7071/api/timeline/u_merlin/assign \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-10-02","slotIdx":0,"task":{"id":"task_123","kind":"business","title":"Test"},"source":"manual"}'
```

---

#### **POST** `/api/timeline/{userId}/autofill`
Plant einen Task automatisch in den nächsten passenden freien Slot gemäß definierten Regeln.

**Request Body**:
```json
{
  "dateFrom": "2025-10-02",
  "task": {
    "id": "task_456",
    "kind": "personal",
    "title": "Dokumente sortieren"
  }
}
```

**Parameter**:
- `dateFrom`: Start-Datum für die Suche nach freien Slots
- `task`: Task-Objekt mit `id`, `kind`, `title`
- Die App sucht automatisch die nächsten 30 Tage nach einem passenden Slot

**Logik**:
- Respektiert Regeln für `business` vs. `personal` Tasks
- Berücksichtigt bereits belegte Slots
- Nutzt Cosmos DB Stored Procedure für konsistente Planung

---

#### **POST** `/api/timeline/{userId}/prioritize`
Priorisiert einen Task, indem er mit dem höchstpriorisierten Task in der Timeline getauscht wird.

**Request Body**:
```json
{
  "taskId": "task_789"
}
```

**Funktion**:
- Findet den Task in der Timeline
- Tauscht Position mit dem ersten (höchstpriorisierten) Task
- Aktualisiert beide Slots atomar

---

### 📝 Task-Management

#### **POST** `/api/tasks/{userId}`
Erstellt einen neuen Task.

**Request Body**:
```json
{
  "id": "task_custom_id",
  "kind": "business",
  "title": "Neue Aufgabe",
  "tags": ["wichtig", "dringend"],
  "status": "open"
}
```

**Parameter**:
- `id` (optional): Custom Task-ID (wird sonst automatisch generiert)
- `kind`: `"business"` oder `"personal"`
- `title`: Aufgabentitel
- `tags` (optional): Array von Tags
- `status` (optional): Status des Tasks (default: `"open"`)

---

#### **GET** `/api/tasks/{userId}/{taskId}`
Ruft Details eines spezifischen Tasks ab.

**Beispiel**:
```bash
curl http://localhost:7071/api/tasks/u_merlin/task_123
```

---

#### **PUT** `/api/tasks/{userId}/{taskId}`
Aktualisiert einen existierenden Task (auch **PATCH** möglich).

**Request Body**: Objekt mit zu aktualisierenden Feldern
```json
{
  "title": "Aktualisierter Titel",
  "status": "in_progress",
  "tags": ["aktualisiert"]
}
```

**Funktion**:
- Merged Updates mit existierendem Task
- Nur angegebene Felder werden geändert

---

#### **DELETE** `/api/tasks/{userId}/{taskId}`
Löscht einen Task aus der Datenbank.

**Beispiel**:
```bash
curl -X DELETE http://localhost:7071/api/tasks/u_merlin/task_123
```

---

### 🌐 Frontend / Test-UI

#### **GET** `/{*path}`
Serviert die statische Test-UI (anonymer Zugriff).

**Funktionen der Test-UI**:
- Username-Verwaltung (localStorage)
- Master Key-Extraktion aus URL
- Interaktive Task- und Timeline-Verwaltung
- Visualisierung der Timeline
- Manuelle Task-Zuweisung
- Auto-Fill-Funktion

**Zugriff**:
- Lokal: `http://localhost:7071/`
- Azure: `https://your-app.azurewebsites.net/?code=YOUR_MASTER_KEY`

---

## Projektstruktur

```
/
├── src/                         # Azure Functions (Backend)
│   ├── functions.js            # Main entry point (registriert alle Functions)
│   ├── _cosmos.js              # Gemeinsamer Cosmos DB Client
│   ├── assignToSlot.js         # POST /api/timeline/{userId}/assign
│   ├── autoFill.js             # POST /api/timeline/{userId}/autofill
│   ├── getTimeline.js          # GET /api/timeline/{userId}
│   ├── createTask.js           # POST /api/tasks/{userId}
│   ├── getTask.js              # GET /api/tasks/{userId}/{taskId}
│   ├── updateTask.js           # PUT /api/tasks/{userId}/{taskId}
│   ├── deleteTask.js           # DELETE /api/tasks/{userId}/{taskId}
│   ├── prioritizeTask.js       # POST /api/timeline/{userId}/prioritize
│   └── serveStatic.js          # GET /{*path} (Test-UI)
├── public/                      # Frontend / Test-UI
│   ├── index.html              # UI
│   ├── app.js                  # Frontend-Logik
│   └── styles.css              # Styles
├── database/                    # Cosmos DB Stored Procedures
│   └── infra/
│       └── deploy-sprocs.js    # Deployment-Script
├── __tests__/                   # Jest Tests
├── documentation/               # Erweiterte Dokumentation
├── host.json                    # Azure Functions Konfiguration
├── package.json                 # Dependencies
└── local.settings.json         # Lokale Konfiguration (nicht in Git)
```

## Tests

Tests ausführen:
```bash
npm test
```

Test-Coverage anzeigen:
```bash
npm run test:coverage
```

Tests umfassen:
- Task-Validierung
- Datums-Utilities
- Voice-Command-Processing
- Table-Management-Logik

Für manuelle Tests siehe: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## Weitere Dokumentation

- **[arc42.md](./documentation/arc42.md)** - Vollständige Architektur-Dokumentation (Betrieb, Deployment, API-Details)
- **[SECURITY_SETUP.md](./documentation/SECURITY_SETUP.md)** - Sicherheits-Setup und Master Key Management
- **[QUICK_START.md](./documentation/QUICK_START.md)** - Schnellstart-Guide für Benutzer und Entwickler
- **[TESTING_GUIDE.md](./documentation/TESTING_GUIDE.md)** - Anleitung für manuelle Tests
- **[documentation/](./documentation/)** - Erweiterte API-Dokumentation

## Technologie-Stack

- **Backend**: Azure Functions v4 (Node.js 18+)
- **Datenbank**: Azure Cosmos DB (NoSQL)
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Programmiermodell**: ES Modules
- **Testing**: Jest
- **Deployment**: Azure Functions Core Tools

## Vorteile der Architektur

1. **Unified Deployment** - Eine einzige Azure Function App für Frontend und Backend
2. **Kosteneffizient** - Kein separates Hosting für Frontend notwendig
3. **Skalierbar** - Azure Functions skaliert automatisch
4. **Sicher** - Master Key Authentication für alle API-Endpoints
5. **Einfache Konfiguration** - Eine Domain, ein SSL-Zertifikat

## Lizenz

Siehe Repository für Lizenzinformationen.