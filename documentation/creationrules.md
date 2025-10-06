
# Task Creation Rules - CodexMiroir

## Übersicht

Dieses Dokument beschreibt alle Regeln und Anforderungen für die Erstellung von Tasks im CodexMiroir-System.

## Struktur eines klassischen Task-Items

### Vollständiges Task-Objekt (Cosmos DB Format)

```json
{
  "id": "task_abc123-def456-ghi789",
  "type": "task",
  "userId": "u_merlin",
  "kind": "business",
  "title": "CodexMiroir Sprint Block",
  "description": "3,5h Fokusblock für Sprint-Entwicklung",
  "notes": [
    {
      "at": "2025-10-01T08:21:00Z",
      "text": "Edgecase Weekend beachten"
    }
  ],
  "tags": ["codexmiroir", "development"],
  "project": {
    "id": "proj_codexmiroir",
    "name": "CodexMiroir"
  },
  "contact": {
    "name": "Marina",
    "email": "marina@example.com"
  },
  "external": {
    "devOpsUrl": null,
    "calendarEventId": null
  },
  "deadline": null,
  "fixed": false,
  "status": "open",
  "priority": 3,
  "checklist": [],
  "worklog": [],
  "planned": {
    "date": "2025-10-03",
    "slotIdx": 0
  },
  "performed": {
    "date": "2025-10-03",
    "slotIdx": 0
  },
  "completedAt": null,
  "createdAt": "2025-10-01T13:00:00Z",
  "updatedAt": "2025-10-01T13:00:00Z"
}
```

### Minimales Task-Objekt (Pflichtfelder)

```json
{
  "type": "task",
  "userId": "u_merlin",
  "kind": "business",
  "title": "Aufgabentitel",
  "status": "open"
}
```

## Pflichtfelder

### Bei API-Request (createTask)

1. **userId** (String, aus URL-Parameter)
   - Format: Beliebiger String
   - Beispiel: `"u_merlin"`
   - Wird aus dem URL-Path extrahiert: `/api/tasks/{userId}`

2. **kind** (String, aus Request Body)
   - Erlaubte Werte: `"business"`, `"personal"`, `"meeting"`
   - **Wichtig**: Im Frontend wird "work" verwendet, API erwartet aber diese Werte
   - Wird validiert durch `validateParams()`

3. **title** (String, aus Request Body)
   - Pflichtfeld für sinnvolle Task-Erstellung
   - Kann leer sein (`""`) aber sollte vorhanden sein

### Automatisch gesetzte Felder

1. **type** (String)
   - Wird automatisch auf `"task"` gesetzt
   - Durch Pre-Trigger `taskNormalizeOnWrite()` oder im Code

2. **status** (String)
   - Default: `"open"`
   - Automatisch gesetzt wenn nicht vorhanden

3. **id** (String)
   - **WIRD AUTOMATISCH VON COSMOS DB VERGEBEN**
   - **Darf NICHT im Request Body enthalten sein**
   - Format: Auto-generierte GUID von Cosmos DB
   - Alternativer Generator (falls benötigt): `generateTaskId()` erzeugt `task_{timestamp}-{random}-{random}`

4. **createdAt** (ISO String)
   - Automatisch auf aktuellen Zeitpunkt gesetzt
   - Format: ISO 8601 (`"2025-10-01T13:00:00Z"`)
   - Nur gesetzt wenn noch nicht vorhanden (durch Pre-Trigger)

5. **updatedAt** (ISO String)
   - Wird bei jedem Schreibvorgang aktualisiert
   - Format: ISO 8601
   - Durch Pre-Trigger `taskNormalizeOnWrite()`

6. **tags** (Array)
   - Default: `[]`
   - Automatisch normalisiert: lowercase, dedupliziert
   - Durch Pre-Trigger verarbeitet

## Optionale Felder

### Beschreibung & Kontext
- **description** (String): Detaillierte Beschreibung
- **notes** (Array): Array von Note-Objekten `{at: ISO-String, text: String}`
- **tags** (Array): Schlagwörter für Kategorisierung

### Projekt & Zuordnung
- **project** (Object): `{id: String, name: String}`
- **contact** (Object): `{name: String, email: String}`
- **external** (Object): `{devOpsUrl: String|null, calendarEventId: String|null}`

### Planung & Deadline
- **deadline** (String|null): ISO 8601 Datum
- **fixed** (Boolean): Ob Task an festem Termin gebunden ist
- **priority** (Number): Prioritätsstufe (z.B. 1-5)

### Timeline-Planung
- **planned** (Object): `{date: String (YYYY-MM-DD), slotIdx: Number}`
- **performed** (Object): `{date: String, slotIdx: Number}`

### Status & Verlauf
- **status** (String): `"open"`, `"in_progress"`, `"completed"`, etc.
- **completedAt** (String|null): ISO 8601 Datum
- **checklist** (Array): Array von Checklist-Items
- **worklog** (Array): Array von Worklog-Einträgen

## Validierungsregeln

### 1. Parameter-Validierung (validateParams)

```javascript
validateParams({ userId, kind }, context)
```

**Prüft:**
- Alle Parameter vorhanden (nicht `null`, `undefined`, leerer String)
- **Ausnahmen**: `0` und `false` sind erlaubte Werte
- Bei Fehler: HTTP 400 mit JSON `{error: "Missing: field1, field2"}`

### 2. Kind-Validierung

**Erlaubte Werte:**
- `"business"` - Geschäftliche Aufgaben
- `"personal"` - Private Aufgaben  
- `"meeting"` - Meeting-Termine

**Frontend-Mapping:**
- Frontend verwendet: `"work"` → muss zu `"business"` gemappt werden
- Frontend verwendet: `"personal"` → bleibt `"personal"`

### 3. Tags-Normalisierung (Pre-Trigger)

```javascript
doc.tags = Array.from(new Set((doc.tags||[]).map(t=>String(t).toLowerCase())));
```

- Konvertiert zu String
- Lowercase
- Entfernt Duplikate
- Default: leeres Array

### 4. ID-Generierung

**WICHTIG:**
```javascript
// ❌ FALSCH - ID im Request Body senden
const task = { id: "T-001", ... };

// ✅ RICHTIG - ID wird automatisch vergeben
const { id, ...bodyWithoutId } = body || {};
const task = { ...bodyWithoutId };
```

Cosmos DB vergibt automatisch eine eindeutige ID.

## Erstellungsprozess

### 1. API-Request

```http
POST /api/tasks/{userId}
Authorization: code=MASTER_KEY
Content-Type: application/json

{
  "kind": "business",
  "title": "Neue Aufgabe",
  "description": "Details...",
  "tags": ["tag1", "TAG2", "tag1"],
  "deadline": "2025-10-15T23:59:59Z"
}
```

### 2. Server-Verarbeitung

1. **Parameter-Extraktion**: `userId` aus URL
2. **Validierung**: `validateParams({ userId, kind })`
3. **ID-Entfernung**: Explizites ID-Feld wird entfernt
4. **Task-Objekt erstellen**:
   ```javascript
   const task = {
     type: "task",
     userId,
     kind,
     title: title || "",
     tags: tags || [],
     status: status || "open",
     createdAt: new Date().toISOString(),
     updatedAt: new Date().toISOString(),
     ...bodyWithoutId
   };
   ```

### 3. Pre-Trigger (taskNormalizeOnWrite)

Wird automatisch vor dem Speichern ausgeführt:
- Setzt `type: "task"` falls nicht vorhanden
- Setzt `status: "open"` falls nicht vorhanden
- Normalisiert `tags` (lowercase, dedupliziert)
- Setzt `createdAt` falls nicht vorhanden
- Aktualisiert `updatedAt` immer

### 4. Cosmos DB Speicherung

- Vergibt automatisch eindeutige `id`
- Speichert im `tasks` Container
- Partition Key: `userId`

### 5. Response

```json
{
  "id": "abc123-def456-ghi789",
  "type": "task",
  "userId": "u_merlin",
  "kind": "business",
  "title": "Neue Aufgabe",
  "description": "Details...",
  "tags": ["tag1", "tag2"],
  "status": "open",
  "createdAt": "2025-10-03T14:23:45.123Z",
  "updatedAt": "2025-10-03T14:23:45.123Z",
  ...
}
```

## Frontend-Integration

### Task-Dialog (index.html)

```javascript
// Feste Termine
if (task.fixed) {
  // Benötigt:
  task.fixedDate = "2025-10-15";  // YYYY-MM-DD
  task.fixedTime = "AM";          // AM, PM oder EV
}

// Mapping für Slots
const slotMap = { 'AM': 0, 'PM': 1, 'EV': 2 };
```

### Automatische Zuweisung

Nach Task-Erstellung kann automatische Timeline-Zuweisung erfolgen:

```javascript
// Für feste Termine
POST /api/timeline/{userId}/assign
{
  "taskId": "abc123...",
  "date": "2025-10-15",
  "slotIdx": 0
}

// Für flexible Tasks
POST /api/timeline/{userId}/autofill
```

## Fehlerbehandlung

### Häufige Fehler

1. **400 Bad Request - Missing Parameters**
   ```json
   {
     "error": "Missing: userId, kind"
   }
   ```

2. **400 Bad Request - Invalid Kind**
   - Kind muss `"business"`, `"personal"` oder `"meeting"` sein

3. **500 Internal Server Error**
   - Cosmos DB Verbindungsprobleme
   - Ungültige Datenstruktur

### Best Practices

1. **ID niemals manuell setzen** - Cosmos DB vergibt automatisch
2. **Kind korrekt mappen** - Frontend "work" → API "business"
3. **ISO 8601 für Datumsangaben** - `YYYY-MM-DDTHH:mm:ssZ`
4. **Tags normalisiert übergeben** - lowercase, keine Duplikate
5. **userId validieren** - muss vorhanden sein
6. **Optionale Felder weglassen** - nicht mit `null` füllen

## Unterschiede zwischen Systemen

### Cosmos DB vs. Legacy API

**Legacy API (Blob Storage):**
```json
{
  "list": "pro",
  "id": "T-001",
  "title": "Task",
  "created_at_iso": "2025-09-23T10:00:00Z",
  "scheduled_slot": "2025-W39-Tue-AM"
}
```

**Cosmos DB (Aktuell):**
```json
{
  "type": "task",
  "userId": "u_merlin",
  "kind": "business",
  "title": "Task",
  "createdAt": "2025-09-23T10:00:00Z",
  "planned": {
    "date": "2025-10-03",
    "slotIdx": 0
  }
}
```

## Zusammenfassung

### Minimal-Request für Task-Erstellung

```http
POST /api/tasks/u_merlin?code=MASTER_KEY
Content-Type: application/json

{
  "kind": "business",
  "title": "Meine Aufgabe"
}
```

### Voller Request mit allen Optionen

```http
POST /api/tasks/u_merlin?code=MASTER_KEY
Content-Type: application/json

{
  "kind": "business",
  "title": "Vollständige Aufgabe",
  "description": "Detaillierte Beschreibung",
  "tags": ["projekt", "wichtig"],
  "project": {
    "id": "proj_001",
    "name": "Projekt Name"
  },
  "contact": {
    "name": "Max Mustermann",
    "email": "max@example.com"
  },
  "deadline": "2025-12-31T23:59:59Z",
  "priority": 1,
  "fixed": false
}
```

Die ID, timestamps und weitere Metadaten werden automatisch vom System vergeben und verwaltet.
