# CodexMiroir API

## Spartarégime: Git → Blob → Timeline

**Keine Task-Management-API!** Tasks werden über Git verwaltet.

Die API dient nur zum:
- **Sync**: GitHub → Blob Storage
- **Render**: Timeline aus Cache generieren

## Datei-basiertes System

- **Location**: GitHub Repo → `codex-miroir/tasks/####.md`
- **Format**: Markdown mit YAML Frontmatter
- **Cache**: Azure Blob Storage (`raw/tasks/`, `artifacts/`)

### Task-Struktur

```yaml
---
typ: task
kategorie: geschäftlich | privat
status: offen | abgeschlossen | abgebrochen
tags: [optional]
deadline: dd.mm.yyyy (optional)
fixedSlot:
  datum: dd.mm.yyyy
  zeit: morgens | nachmittags | abends
---

# Task-Beschreibung

Freier Markdown-Text für Details, Notizen, etc.
```

## Timeline-Regeln

### Slots pro Tag
- **morgens**: 09:00-12:30
- **nachmittags**: 13:30-17:00
- **abends**: 18:00-21:30 (nur per fixedSlot)

### Auto-Fill Logik
1. **Fixed first**: Tasks mit `fixedSlot` werden zuerst platziert
2. **Automatische Planung**: Tasks ohne `fixedSlot` werden nach Dateinamen-Reihenfolge (0000-9999) zugewiesen
3. **Kategorie-Regeln**:
   - `geschäftlich`: Mo-Fr, morgens → nachmittags
   - `privat`: Sa-So, morgens → nachmittags
   - `abends`: nie auto-befüllbar

### Domino-Logik bei Konflikten
- Fixed Tasks bleiben stehen
- Nicht-fixe Tasks werden vorwärts geschoben (morgens → nachmittags → abends)
- Überlauf geht in den nächsten passenden Tag

## API Endpoints

### 1. Create Task

**POST** `/api/tasks`

Erstellt eine neue Task-Datei im GitHub Repository mit automatischer ID-Vergabe.

#### Request Headers
- `Content-Type: application/json`
- `Idempotency-Key: <uuid>` (optional, empfohlen für Retry-Safety)

#### Request Body
```json
{
  "kategorie": "geschäftlich | privat",
  "status": "offen",
  "deadline": "dd.mm.yyyy",
  "fixedSlot": {
    "datum": "dd.mm.yyyy",
    "zeit": "morgens | nachmittags | abends"
  },
  "tags": ["tag1", "tag2"],
  "body": "Freitext-Beschreibung"
}
```

**Pflichtfelder:**
- `kategorie`: `geschäftlich` oder `privat`

**Optionale Felder:**
- `status`: Standard ist `offen`
- `deadline`: Format `dd.mm.yyyy`
- `fixedSlot`: Objekt mit `datum` und `zeit`
- `tags`: Array von Strings
- `body`: Markdown-Freitext

#### Response
```json
{
  "ok": true,
  "id": "0042",
  "path": "codex-miroir/tasks/0042.md",
  "commitSha": "abc123...",
  "htmlUrl": "https://github.com/..."
}
```

#### Features
- **Atomare ID-Vergabe**: Blob-Lease verhindert Doppel-IDs bei parallelen Requests
- **Idempotenz**: Mit `Idempotency-Key` Header keine Doppel-Tasks bei Retries
- **Sofortiger Cache**: Task wird direkt in Blob Storage geschrieben
- **GitHub Integration**: Commit direkt oder via PR (ENV: `CREATE_VIA_PR=true`)

#### Fehler-Responses
- `400`: Validierungsfehler (z.B. ungültige Kategorie)
- `500`: GitHub API Fehler oder Blob Storage Fehler

### 2. Manual Sync
- **POST /sync?mode=full** - Vollständiger Sync von GitHub
- **POST /sync?mode=diff&since=SHA** - Diff-basierter Sync

### Render API
- **GET /codex?format=json** - Timeline als JSON
- **GET /codex?format=html** - Timeline als HTML

### GitHub Webhook
- **POST /github/webhook** - Automatischer Sync bei Push

## HTTP Caching
- **ETag**: Basierend auf Git HEAD SHA
- **304 Not Modified**: Bei unverändertem Content

## Deployment

Die API läuft als Azure Functions App und synchronisiert sich automatisch mit einem GitHub Repository.

**Environment Variables:**
- `GITHUB_OWNER` - GitHub Repository Owner
- `GITHUB_REPO` - Repository Name
- `GITHUB_BRANCH` - Branch (default: main)
- `GITHUB_BASE_PATH` - Pfad im Repo (z.B. "codex-miroir")
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `AZURE_BLOB_CONN` - Azure Blob Storage Connection String
- `AZURE_BLOB_CONTAINER` - Container Name (z.B. "codex-cache")

## Beispiele

### Task erstellen (GitHub)
```bash
# In codex-miroir/tasks/ eine neue Datei erstellen:
echo '---
typ: task
kategorie: geschäftlich
status: offen
deadline: 15.10.2025
---

# Sprint Planning Meeting vorbereiten

- Agenda erstellen
- Team einladen
- Raum buchen' > tasks/0042.md

git add tasks/0042.md
git commit -m "Add task 0042"
git push
```

### Timeline abrufen
```bash
# JSON Format
curl https://your-app.azurewebsites.net/codex?format=json

# HTML Format (Browser)
https://your-app.azurewebsites.net/codex?format=html
```

### Manueller Sync triggern
```bash
# Full Sync
curl -X POST https://your-app.azurewebsites.net/sync?mode=full

# Diff Sync seit letztem SHA
curl -X POST https://your-app.azurewebsites.net/sync?mode=diff&since=abc123def
```

## Cache-Verwaltung

- Timeline wird als JSON im Blob Storage gecacht
- Cache-Key: `artifacts/timeline_{headSha}.json`
- Bei GitHub Push: Webhook triggert neuen Build
- ETag verhindert unnötigen Download

## Fehlerbehandlung

- **404**: Timeline nicht gefunden
- **304**: Content nicht geändert (ETag Match)
- **500**: Server-Fehler (GitHub/Blob Storage nicht erreichbar)