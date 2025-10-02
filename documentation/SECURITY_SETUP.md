# CodexMiroir - Sicherheits-Setup

## Überblick

Die Azure Functions sind nun mit **Admin-Level-Authentifizierung** gesichert. Dies bedeutet, dass alle API-Aufrufe einen Master Function Key benötigen.

## Funktionsweise

### Backend-Sicherheit

Alle API-Endpoints erfordern jetzt einen Master Key:
- `GET /api/timeline/{userId}` - Timeline abrufen
- `POST /api/tasks/{userId}` - Task erstellen
- `GET /api/tasks/{userId}/{taskId}` - Task abrufen
- `PUT /api/tasks/{userId}/{taskId}` - Task aktualisieren
- `POST /api/timeline/{userId}/assign` - Task einem Slot zuweisen
- `POST /api/timeline/{userId}/autofill` - Task automatisch zuweisen
- `POST /api/timeline/{userId}/prioritize` - Task priorisieren

Die statische Frontend-Auslieferung (`/`) bleibt anonym zugänglich.

### Frontend-Integration

Das Frontend extrahiert automatisch den Function Key aus der URL:

1. **Query Parameter**: `https://your-app.azurewebsites.net/?code=YOUR_FUNCTION_KEY`
2. **Fragment**: `https://your-app.azurewebsites.net/#code=YOUR_FUNCTION_KEY`

Der Key wird dann bei allen API-Aufrufen automatisch als `?code=...` Parameter mitgeschickt.

### Benutzerverwaltung

- Beim ersten Besuch wird der Benutzer nach seinem Username gefragt
- Der Username wird im `localStorage` gespeichert
- Bei zukünftigen Besuchen wird der Username automatisch geladen
- Der Username kann jederzeit im UI geändert werden

## Deployment

### 1. Azure Function App deployen

```bash
func azure functionapp publish <your-function-app-name>
```

### 2. Master Key abrufen

Nach dem Deployment den Master Key abrufen:

**Option A: Azure Portal**
1. Navigiere zu deiner Function App
2. Gehe zu "Functions" → "App keys"
3. Kopiere den "default" Master Key

**Option B: Azure CLI**
```bash
az functionapp keys list --name <your-function-app-name> --resource-group <your-resource-group>
```

### 3. Frontend-URL mit Key erstellen

Erstelle eine URL mit dem Master Key:

```
https://your-function-app.azurewebsites.net/?code=<YOUR_MASTER_KEY>
```

**Wichtig**: Teile diese URL nur mit autorisierten Benutzern!

## Sicherheitshinweise

### ✅ Vorteile

- Alle API-Endpoints sind durch Master Key geschützt
- Keine zusätzliche Konfiguration im Frontend nötig
- Frontend und Backend sind auf demselben Host
- Einfache Wartung

### ⚠️ Wichtige Punkte

1. **Master Key geheim halten**: Der Master Key gibt vollen Zugriff auf alle Functions
2. **URL-Sharing**: Wer die URL mit dem Key kennt, hat Zugriff
3. **HTTPS verwenden**: In Produktion immer HTTPS nutzen (automatisch bei Azure)
4. **Key-Rotation**: Master Key regelmäßig wechseln für zusätzliche Sicherheit

### 🔒 Best Practices

1. **Für Entwicklung**: Lokale `local.settings.json` verwenden
2. **Für Produktion**: Master Key nur über sichere Kanäle teilen
3. **Monitoring**: Azure Application Insights nutzen für Zugriffsprotokolle
4. **Backup**: Username ist nur im Browser localStorage - bei Gerätewechsel neu eingeben

## Lokale Entwicklung

### local.settings.json erstellen

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://...;AccountKey=...;",
    "COSMOS_DB": "codexmiroir",
    "COSMOS_TIMELINE": "timeline",
    "COSMOS_TASKS": "tasks",
    "USERS_CSV": "u_merlin",
    "DAY_HORIZON": "30"
  }
}
```

### Lokal starten

```bash
npm install
npm start
```

Das Frontend ist dann verfügbar unter: `http://localhost:7071/`

**Hinweis**: Bei lokaler Entwicklung wird kein Function Key benötigt (authLevel wird ignoriert).

## Troubleshooting

### "Unauthorized" Fehler

- **Ursache**: Master Key fehlt oder ist ungültig
- **Lösung**: URL mit `?code=...` Parameter aufrufen

### Username-Prompt erscheint immer wieder

- **Ursache**: LocalStorage wird nicht gespeichert (z.B. Inkognito-Modus)
- **Lösung**: Normalen Browser-Modus verwenden oder Username manuell eingeben

### API-Aufrufe schlagen fehl

- **Ursache**: Relative Pfade funktionieren nicht
- **Lösung**: Prüfe ob Frontend und Backend auf demselben Host laufen
- **Debug**: Browser-Konsole öffnen und Netzwerk-Tab prüfen

### Function Key in URL sichtbar

- **Ist normal**: Der Key wird per Query Parameter übertragen
- **Alternative**: Fragment-Syntax verwenden: `#code=...` (wird nicht an Server gesendet)
- **Sicherheit**: In Produktion immer HTTPS verwenden

## Migration von alter Version

Falls du von der alten Version mit `authLevel: "function"` migrierst:

1. Deploy neue Version
2. Master Key aus Azure Portal holen
3. URL mit Master Key an Benutzer verteilen
4. Alte URLs funktionieren nicht mehr

## Support

Bei Problemen:
1. Azure Portal → Function App → Monitor → Logs prüfen
2. Browser-Konsole auf Fehler prüfen
3. Application Insights für detaillierte Logs nutzen
