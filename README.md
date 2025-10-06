
# CodexMiroir

**CodexMiroir** ist ein Git-basiertes Task-Management-System nach dem **Spartarégime-Prinzip**: Keine Prio, kein Snooze, keine fancy Felder - nur nummerierte Markdown-Dateien.

## Kernkonzept

- **Tasks sind Dateien**: `0000.md` bis `9999.md` in GitHub Repository (`codex-miroir/tasks/`)
- **Dateiname = Priorität**: Niedrigere Nummer wird zuerst eingeplant
- **Git = Source of Truth**: Alle Änderungen über Git Commits
- **Automatischer Sync**: GitHub Webhook → Azure Function → Blob Storage Cache
- **Timeline-Rendering**: Deterministische Berechnung der Wochenansicht
- **Kategorie-Regeln**: geschäftlich (Mo-Fr) vs. privat (Sa-So)
- **Fixed-First-Logik**: Tasks mit fixedSlot werden zuerst platziert
- **Auto-Fill**: Restliche Tasks nach Dateinamen-Reihenfolge

## Setup & Installation

### Voraussetzungen

#### Für lokale Entwicklung:
- **Node.js** 18+ (LTS empfohlen)
- **Azure Functions Core Tools v4** (`npm install -g azure-functions-core-tools@4`)
- **Azure Blob Storage** (oder lokaler Azurite Emulator)
- **GitHub Token** mit `repo` Scope
- **Git** zum Klonen des Repository

#### Für Azure Deployment:
- Azure Account mit aktiver Subscription
- Azure Function App
- Azure Blob Storage Account
- GitHub Repository mit Tasks
- Azure CLI (optional)

### Lokale Entwicklung einrichten

#### 1. Repository klonen
```bash
git clone https://github.com/merlinbecker/CodexMiroir.git
cd CodexMiroir
npm install
```

#### 2. Environment Variables konfigurieren

Die Datei `local.settings.json` ist bereits vorhanden:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "GITHUB_OWNER": "merlinbecker",
    "GITHUB_REPO": "thoughts-vault",
    "GITHUB_BRANCH": "master",
    "GITHUB_BASE_PATH": "codexMiroir",
    "GITHUB_TOKEN": "<YOUR_GITHUB_TOKEN>",
    "AZURE_BLOB_CONN": "<YOUR_BLOB_CONNECTION_STRING>",
    "AZURE_BLOB_CONTAINER": "codex-cache",
    "CREATE_VIA_PR": "false",
    "GITHUB_PR_BRANCH_PREFIX": "codex/tasks"
  }
}
```

**📝 Wichtige Einstellungen:**

| Variable | Beschreibung | Wo bekomme ich das? |
|----------|--------------|---------------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | GitHub → Settings → Developer settings → Tokens |
| `GITHUB_OWNER` | Dein GitHub Username | Dein Profil |
| `GITHUB_REPO` | Repository Name | Dein Repository |
| `GITHUB_BASE_PATH` | Pfad zu Tasks im Repo | z.B. `codexMiroir` |
| `AZURE_BLOB_CONN` | Blob Storage Connection String | Azure Portal → Storage Account → Access keys |
| `CREATE_VIA_PR` | Tasks via PR erstellen | `true` oder `false` |

#### 3. Azure Blob Storage einrichten

**Option A: Azurite Emulator (lokal, für Entwicklung)**
```bash
npm install -g azurite
azurite --silent --location ./azurite
```
→ Nutze `AzureWebJobsStorage: "UseDevelopmentStorage=true"`

**Option B: Azure Blob Storage (Cloud)**
1. Azure Portal → Create Storage Account
2. Name: `codexmiroirstorage` (muss global unique sein)
3. Region: `West Europe`
4. Performance: `Standard`, Redundancy: `LRS`
5. Nach Erstellung: Access keys → Connection string kopieren
6. In `local.settings.json` einfügen als `AZURE_BLOB_CONN`

#### 4. GitHub Token erstellen

1. GitHub → Settings → Developer settings → Personal access tokens → **Generate new token (classic)**
2. Note: `CodexMiroir Local Dev`
3. Expiration: `90 days` (oder länger)
4. **Scopes auswählen**: ✅ `repo` (Full control of private repositories)
5. Generate token → Token kopieren
6. In `local.settings.json` einfügen als `GITHUB_TOKEN`

⚠️ **Wichtig**: Token niemals in Git committen!

#### 5. Function App starten

```bash
npm start
```

Browser öffnen: `http://localhost:5000/`

✅ **Die UI sollte nun laufen!**

### Azure Deployment

#### 1. Azure Resources erstellen

```bash
# Resource Group
az group create --name codexmiroir-rg --location westeurope

# Storage Account
az storage account create \
  --name codexmiroirstorage \
  --resource-group codexmiroir-rg \
  --location westeurope \
  --sku Standard_LRS

# Blob Container erstellen
az storage container create \
  --name codex-cache \
  --account-name codexmiroirstorage

# Function App
az functionapp create \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --consumption-plan-location westeurope \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --storage-account codexmiroirstorage
```

#### 2. Environment Variables konfigurieren

```bash
# Blob Connection String abrufen
BLOB_CONN=$(az storage account show-connection-string \
  --name codexmiroirstorage \
  --resource-group codexmiroir-rg \
  --query connectionString -o tsv)

# App Settings setzen
az functionapp config appsettings set \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --settings \
    "GITHUB_TOKEN=<your-github-token>" \
    "GITHUB_OWNER=merlinbecker" \
    "GITHUB_REPO=thoughts-vault" \
    "GITHUB_BRANCH=master" \
    "GITHUB_BASE_PATH=codexMiroir" \
    "AZURE_BLOB_CONN=$BLOB_CONN" \
    "AZURE_BLOB_CONTAINER=codex-cache" \
    "CREATE_VIA_PR=false"
```

#### 3. Function App deployen

```bash
func azure functionapp publish codexmiroir-func
```

#### 4. GitHub Webhook einrichten

1. GitHub Repository → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**: `https://codexmiroir-func.azurewebsites.net/github/webhook`
3. **Content type**: `application/json`
4. **Secret**: Generiere starkes Secret (z.B. `openssl rand -hex 32`)
5. Setze Secret in Azure:
   ```bash
   az functionapp config appsettings set \
     --name codexmiroir-func \
     --resource-group codexmiroir-rg \
     --settings "GITHUB_WEBHOOK_SECRET=<your-secret>"
   ```
6. **Events**: ✅ `push`
7. **Active**: ✅

#### 5. Initial Sync ausführen

```bash
# Full Sync mit Clean-Option
curl -X POST https://codexmiroir-func.azurewebsites.net/sync?clean=true
```

✅ **Deployment abgeschlossen!**

Öffne: `https://codexmiroir-func.azurewebsites.net/`

## API-Routen

### 📋 Task Management

#### **POST** `/api/tasks`
Erstellt neuen Task in GitHub.

**Request Body**:
```json
{
  "kategorie": "geschäftlich",
  "deadline": "02.10.2025",
  "fixedSlot": {
    "datum": "02.10.2025",
    "zeit": "morgens"
  },
  "tags": ["wichtig"],
  "body": "Task Beschreibung"
}
```

**Response**:
```json
{
  "ok": true,
  "id": "0042",
  "path": "codex-miroir/tasks/0042.md",
  "commitSha": "abc123...",
  "htmlUrl": "https://github.com/..."
}
```

**Mit Idempotenz-Key** (verhindert Duplikate):
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "idempotency-key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{"kategorie":"privat","body":"Task"}'
```

#### **PUT/PATCH** `/api/tasks/{id}`
Aktualisiert existierenden Task.

**Request Body** (alle Felder optional):
```json
{
  "status": "abgeschlossen",
  "deadline": "05.10.2025"
}
```

### 🔄 Sync Functions

#### **POST** `/github/webhook`
GitHub Webhook Handler (automatischer Sync bei Push).

#### **GET/POST** `/sync`
Manueller Sync Trigger.

**Parameter**:
- `clean=true` → Löscht Cache vor Sync (Full-Sync)

```bash
curl -X POST http://localhost:5000/sync?clean=true
```

### 📊 Timeline Rendering

#### **GET** `/codex`
Rendert Timeline als JSON oder HTML.

**Parameter**:
- `format=json` → JSON Output (default)
- `format=html` → HTML Output

```bash
curl http://localhost:5000/codex?format=html
```

### 🌐 Frontend

#### **GET** `/{*path}`
Serviert statische UI (public access).

## Konfigurationsoptionen

### GitHub Integration

```bash
# Standard-Branch (default: main)
GITHUB_DEFAULT_BRANCH=master

# Base-Pfad im Repo (default: codex-miroir)
GITHUB_BASE_PATH=tasks

# Committer Info
GITHUB_COMMITTER_NAME="Codex Bot"
GITHUB_COMMITTER_EMAIL="bot@example.com"
```

### PR-Modus aktivieren

```bash
# Tasks via Pull Requests erstellen
CREATE_VIA_PR=true

# Branch-Prefix für PRs
GITHUB_PR_BRANCH_PREFIX=codex/tasks
```

**Resultat**: Jeder neue Task erstellt einen Feature-Branch + PR statt direktem Commit.

### Validierungsregeln

**Kategorie**:
- Muss `geschäftlich` oder `privat` sein

**Deadline/Datum**:
- Format: `dd.mm.yyyy` (z.B. "02.10.2025")

**Fixed Slot Zeit**:
- Muss `morgens`, `nachmittags` oder `abends` sein

## Troubleshooting

### Lokale Entwicklung

❌ **"GITHUB_TOKEN not configured"**
→ Setze `GITHUB_TOKEN` in `local.settings.json`

❌ **"Blob container not found"**
→ Starte Azurite Emulator oder erstelle Container in Azure

❌ **Timer Function Warnung**
→ Normal ohne Storage Emulator, HTTP-Endpoints funktionieren trotzdem

### Azure Deployment

❌ **Webhook-Aufrufe schlagen fehl**
→ Prüfe GitHub Webhook Secret, validiere Signature-Berechnung

❌ **Sync funktioniert nicht**
→ Prüfe GitHub Token Permissions (benötigt `repo` Scope)

❌ **Cache-Updates fehlen**
→ Prüfe Blob Storage Connection String, Container-Name

## Projektstruktur

```
/
├── src/                         # Azure Functions (Backend)
│   ├── functions.js            # Main entry point
│   ├── createTask.js           # POST /api/tasks
│   ├── updateTask.js           # PUT /api/tasks/{id}
│   ├── githubWebhook.js        # POST /github/webhook
│   ├── manualSync.js           # GET/POST /sync
│   ├── renderCodex.js          # GET /codex
│   └── serveStatic.js          # GET /{*path}
├── shared/                      # Gemeinsame Module
│   ├── storage.js              # Blob Storage Client
│   ├── sync.js                 # GitHub Sync Logic
│   ├── parsing.js              # Markdown Parser
│   └── id.js                   # ID Lock Management
├── public/                      # Frontend UI
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── documentation/               # Erweiterte Docs
│   ├── arc42.md                # Architektur-Dokumentation
│   ├── QUICK_START.md          # Schnellstart-Guide
│   └── SECURITY_SETUP.md       # Sicherheits-Setup
├── local.settings.json         # Lokale Konfiguration (nicht in Git!)
├── host.json                   # Azure Functions Config
└── package.json                # Dependencies
```

## Tests

```bash
# Tests ausführen
npm test

# Mit Coverage
npm run test:coverage
```

## Weitere Dokumentation

- **[arc42.md](./documentation/arc42.md)** - Vollständige Architektur-Dokumentation
- **[QUICK_START.md](./documentation/QUICK_START.md)** - Schnellstart-Guide
- **[SECURITY_SETUP.md](./documentation/SECURITY_SETUP.md)** - Sicherheits-Setup
- **[TESTING_GUIDE.md](./documentation/TESTING_GUIDE.md)** - Test-Anleitung

## Technologie-Stack

- **Backend**: Azure Functions v4 (Node.js 18+, ES Modules)
- **Storage**: Azure Blob Storage (Cache) + GitHub (Source of Truth)
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Sync**: GitHub Webhooks + GitHub API
- **Testing**: Jest

## Lizenz

Siehe Repository für Lizenzinformationen.
