# CodexMiroir - Neue Function App Struktur

## Überblick

Die neue Function App ist komplett neu strukturiert basierend auf dem Azure Function Plan. Die alte Struktur wurde entfernt.

## Struktur

```
/src/
  functions.js         # Main entry point (imports all functions)
  _cosmos.js           # Gemeinsamer Cosmos DB Client
  assignToSlot.js      # POST /api/timeline/{userId}/assign (authLevel: admin)
  autoFill.js          # POST /api/timeline/{userId}/autofill (authLevel: admin)
  getTimeline.js       # GET /api/timeline/{userId} (authLevel: admin)
  createTask.js        # POST /api/tasks/{userId} (authLevel: admin)
  getTask.js           # GET /api/tasks/{userId}/{taskId} (authLevel: admin)
  updateTask.js        # PUT /api/tasks/{userId}/{taskId} (authLevel: admin)
  prioritizeTask.js    # POST /api/timeline/{userId}/prioritize (authLevel: admin)
  serveStatic.js       # Serviert die Test-UI (authLevel: anonymous)
/public/
  index.html           # Test-UI mit Benutzerverwaltung
  app.js               # Frontend-Logik mit Key-Extraktion
  styles.css           # Styles
```

## Sicherheit ⚠️

**Alle API-Endpoints sind jetzt mit `authLevel: "admin"` gesichert!**

Das bedeutet:
- Alle API-Aufrufe benötigen einen Master Function Key
- Der Key wird als Query Parameter übergeben: `?code=YOUR_KEY`
- Das Frontend extrahiert den Key automatisch aus der URL
- Die statische Auslieferung (`/`) bleibt anonym zugänglich

**Siehe [SECURITY_SETUP.md](./SECURITY_SETUP.md) für Details zur Konfiguration!**

## Wichtige Änderungen

### 1. Sicherheit (NEU)
Alle API-Functions benötigen jetzt einen Master Key:
- `authLevel: "admin"` für alle API-Endpoints
- Frontend extrahiert Key automatisch aus URL (`?code=...` oder `#code=...`)
- Username wird im localStorage gespeichert und bei Bedarf abgefragt
- Siehe [SECURITY_SETUP.md](./SECURITY_SETUP.md) für Details

### 2. User ID im Pfad
Die User ID wird jetzt über den URL-Pfad übergeben, nicht mehr als ENV-Variable:
- `POST /api/timeline/{userId}/assign`
- `POST /api/timeline/{userId}/autofill`
- `GET /api/timeline/{userId}`

### 3. Cosmos DB Connection String
Die Cosmos DB wird jetzt über einen Connection String initialisiert:
```javascript
const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
```

### 4. ES Modules
Die App nutzt jetzt ES Modules (`type: "module"` in package.json)

## Konfiguration

### local.settings.json

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

**Wichtig:** Trage deinen echten Cosmos DB Connection String ein!

### Azure Function App Settings

In der Function App unter "Configuration" folgende Environment Variables setzen:
- `COSMOS_CONNECTION_STRING`: Dein Cosmos DB Connection String
- `COSMOS_DB`: `codexmiroir`
- `COSMOS_TIMELINE`: `timeline`
- `COSMOS_TASKS`: `tasks`
- `USERS_CSV`: `u_merlin` (oder mehrere User komma-separiert)
- `DAY_HORIZON`: `30`

## Lokale Entwicklung

1. **Dependencies installieren:**
   ```bash
   npm install
   ```

2. **Cosmos DB Connection String setzen:**
   Bearbeite `local.settings.json` und trage deinen Connection String ein.

3. **Function App starten:**
   ```bash
   npm start
   # oder
   func start
   ```

4. **Test-UI öffnen:**
   Browser öffnen: http://localhost:7071
   
   **Hinweis**: Bei lokaler Entwicklung wird der Function Key ignoriert. In Produktion muss die URL mit `?code=YOUR_MASTER_KEY` aufgerufen werden.

5. **Username eingeben:**
   Beim ersten Öffnen wirst du nach deinem Username gefragt (z.B. `u_merlin`). Dieser wird im localStorage gespeichert.

## Test-UI Features

Die Test-UI ermöglicht:

- **Automatische Benutzerverwaltung**: Username wird beim ersten Besuch abgefragt und gespeichert
- **Function Key Support**: Extrahiert automatisch den Key aus der URL (`?code=...`)
- **Timeline anzeigen**: Lade die Timeline für einen User mit Datums-Filter
- **Tasks erstellen**: Erstelle neue Business- oder Personal-Tasks
- **Tasks automatisch zuweisen**: AutoFill findet den nächsten freien Slot
- **Tasks priorisieren**: Tausche Tasks in der Timeline
- **Business/Privat-Modus**: Filtere zwischen Geschäfts- und Privat-Tasks
- **Relative Pfade**: Keine Backend-URL-Konfiguration nötig

## API Endpoints

**Alle Endpoints benötigen einen Master Function Key (`?code=...`) außer serveStatic!**

### GET /api/timeline/{userId}
Timeline für einen User abrufen.

Query Parameter:
- `dateFrom` (optional): Von-Datum im Format YYYY-MM-DD
- `dateTo` (optional): Bis-Datum im Format YYYY-MM-DD

Beispiel:
```bash
curl "http://localhost:7071/timeline/u_merlin?dateFrom=2025-10-02&dateTo=2025-10-09"
```

### POST /timeline/{userId}/assign
Task manuell einem Slot zuweisen.

Body:
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

Beispiel:
```bash
curl -X POST http://localhost:7071/timeline/u_merlin/assign \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-10-02","slotIdx":0,"task":{"id":"task_123","kind":"business","title":"Test"},"source":"manual"}'
```

### POST /timeline/{userId}/autofill
Task automatisch in den nächsten freien Slot einplanen.

Body:
```json
{
  "dateFrom": "2025-10-02",
  "task": {
    "id": "task_456",
    "kind": "personal",
    "title": "Einkaufen"
  }
}
```

Beispiel:
```bash
curl -X POST http://localhost:7071/timeline/u_merlin/autofill \
  -H "Content-Type: application/json" \
  -d '{"dateFrom":"2025-10-02","task":{"id":"task_456","kind":"personal","title":"Einkaufen"}}'
```

## Timer Function

Die Timer Function `ensureDaysTimer` läuft täglich um 04:00 UTC und erstellt automatisch Day-Dokumente für die nächsten 30 Tage (konfigurierbar via `DAY_HORIZON`).

Manuell testen:
```bash
# Timer Function manuell triggern (wenn lokal gestartet)
curl -X POST http://localhost:7071/admin/functions/ensureDaysTimer
```

## Deployment

1. **Azure Function App erstellen** (falls noch nicht vorhanden)

2. **Settings konfigurieren** (siehe oben)

3. **Deployen:**
   ```bash
   func azure functionapp publish <your-function-app-name>
   ```

## Nächste Schritte

1. ✅ Cosmos DB Connection String in `local.settings.json` eintragen
2. ✅ Stored Procedures deployen (siehe `/database/infra/deploy-sprocs.js`)
3. ✅ Timer Function manuell ausführen oder warten bis 04:00 UTC
4. ✅ Test-UI nutzen um die Functions zu testen
5. 🚀 Nach Azure deployen

## Troubleshooting

**Warnung: "The listener for function 'ensureDaysTimer' was unable to start"**
- Das ist normal in der lokalen Entwicklung wenn kein Azure Storage Emulator läuft
- Die HTTP-Endpoints funktionieren trotzdem
- In Azure funktioniert der Timer automatisch

**Fehler: "COSMOS_CONNECTION_STRING environment variable is required"**
- Connection String in `local.settings.json` setzen

**Fehler: "Keine Timeline-Daten gefunden"**
- Timer Function ausführen um Day-Dokumente zu erstellen
- Oder manuell Day-Dokumente in Cosmos DB anlegen

**Fehler beim Assign: "Slot is locked"**
- Abend-Slots (EV, idx=2) sind standardmäßig locked
- Nur AM (idx=0) und PM (idx=1) sind verfügbar

**Fehler beim AutoFill: "No free slot found"**
- Regeln in den Stored Procedures prüfen
- Business-Tasks nur Mo-Fr, Personal/Routine auch am Wochenende
