# CodexMiroir API Documentation (Spartan Edition)

## Systemkonzept

CodexMiroir folgt dem **Spartarégime**: Keine Prio, kein Snooze, keine fancy Felder.
Nur nummerierte Markdown-Dateien (`0000.md` bis `9999.md`) und deterministische Timeline-Zuordnung.

## Datei-basiertes System

### Task-Dateien
- **Location**: `raw/tasks/####.md` (z.B. `0000.md`, `0001.md`, etc.)
- **Format**: Markdown mit YAML Frontmatter
- **Nummerierung**: 0000-9999, niedrigere Nummern = höhere Priorität

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

### Sync API
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