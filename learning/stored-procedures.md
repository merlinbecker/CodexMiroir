# Learning: Stored Procedures in Cosmos DB

## Zusammenfassung

Implementierung von Stored Procedures in Azure Cosmos DB für die automatische und manuelle Zuweisung von Tasks zu Timeline-Slots. Das System verwaltet eine Timeline mit 3 Slots pro Tag (AM, PM, EV) und berücksichtigt Business-Regeln für Werktage vs. Wochenenden.

## Der ursprüngliche Plan

**Ziel:** Regelbasierte Logik serverseitig in Cosmos DB implementieren, um atomare Operationen zu garantieren und Netzwerk-Roundtrips zu minimieren.

**Geplante Komponenten:**
1. **Stored Procedure `assignTaskToFirstFreeSlot`** - AutoFill-Logik
   - Findet automatisch den ersten freien Slot ab einem Datum
   - Respektiert Business-Regeln: work → Mo-Fr, personal → Sa-So
   - Überspringt gesperrte und manualOnly Slots
   
2. **Stored Procedure `assignTaskToSpecificSlot`** - Manuelle Zuweisung
   - Erlaubt manuelle Platzierung auf spezifischen Slots
   - Unterstützt "Schieben" von Tasks bei Slot-Konflikten
   - Carry-Over in den nächsten Tag bei Überlauf
   - Ausnahme für `fixed:true` Tasks (z.B. Meetings)

3. **Pre-Trigger `taskNormalizeOnWrite`** - Datennormalisierung
   - Setzt Default-Werte (type, status)
   - Normalisiert Tags (lowercase, dedupliziert)
   - Pflegt Timestamps (createdAt, updatedAt)

**Deployment-Strategie:**
- Deploy-Skript für idempotente Updates via `replace` oder `create`
- Versionierung über Git, nicht in der DB
- Environment Variables für Konfiguration

## Die Implementierung

### Dateistruktur
```
database/
  timeline/
    assignTaskToFirstFreeSlot.js
    assignTaskToSpecificSlot.js
  pretriggers/
    tasks/
      taskNormalizeOnWrite.js
  infra/
    deploy-sprocs.js
```

### Datenmodell

**Container `timeline` (PK: `/userId`)**
```json
{
  "id": "2025-10-01",
  "type": "day",
  "userId": "u_merlin",
  "weekday": 3,
  "slots": [
    { 
      "idx": 0, 
      "label": "AM", 
      "locked": false, 
      "manualOnly": false,
      "assignment": { "taskId": null, "kind": null, "source": null }
    }
  ]
}
```

**Container `tasks` (PK: `/userId`)**
```json
{
  "id": "task_123",
  "userId": "u_merlin",
  "kind": "work",  // "work" | "personal" | "meeting"
  "fixed": false,  // Ausnahme für Schedule-Regeln
  "status": "open",
  "planned": { "date": "2025-10-03", "slotIdx": 0 }
}
```

### Kernlogik der Stored Procedures

**assignTaskToFirstFreeSlot:**
```javascript
// Query alle Tage ab dateFrom, aufsteigend sortiert
const q = {
  query: "SELECT * FROM c WHERE c.type='day' AND c.userId=@u AND c.id>=@d ORDER BY c.id ASC",
  parameters: [{name:"@u",value:userId},{name:"@d",value:dateFrom}]
};

// Iteriere durch Tage und Slots
for (var di=0; di<docs.length; di++){
  var day = docs[di], wknd = day.weekday >= 6;
  // Prüfe Schedule-Regel
  var violatesSchedule = (task.kind==="work" && wknd) || (task.kind==="personal" && !wknd);
  if (violatesSchedule && !(task.fixed === true)) continue;
  
  // Finde freien Slot
  for (var i=0; i<day.slots.length; i++){
    var s = day.slots[i];
    if (s.manualOnly || s.locked) continue;
    if (!s.assignment || !s.assignment.taskId){
      s.assignment = { taskId: task.id, kind: task.kind, source: "auto" };
      return coll.replaceDocument(day._self, day, callback);
    }
  }
}
```

**assignTaskToSpecificSlot mit Shift-Logik:**
```javascript
function shiftFollowing(day, fromIdx){
  // Carry = letzter Slot vor dem Übertrag
  var carry = day.slots[day.slots.length-1].assignment;
  // Alle Slots nach rechts verschieben
  for (var i=day.slots.length-1; i>fromIdx; i--) {
    day.slots[i].assignment = day.slots[i-1].assignment;
  }
  day.slots[fromIdx].assignment = null;
  
  // Carry in nächsten Tag übertragen
  if (carry && carry.taskId){
    var nd = nextDate(day.id);
    // Finde ersten legalen freien Slot im nächsten Tag
    for (var j=0; j<next.slots.length; j++){
      var ns = next.slots[j];
      if (ns.manualOnly || ns.locked) continue;
      var violates = (wk && carry.kind==="work") || (!wk && carry.kind==="personal");
      if (violates && !(carry.fixed === true)) continue;
      if (!ns.assignment || !ns.assignment.taskId){
        ns.assignment = carry;
        return coll.replaceDocument(next._self, next, callback);
      }
    }
  }
}
```

**taskNormalizeOnWrite Trigger:**
```javascript
function taskNormalizeOnWrite(){
  const doc = req.getBody();
  doc.type = doc.type || "task";
  doc.status = doc.status || "open";
  doc.tags = Array.from(new Set((doc.tags||[]).map(t=>String(t).toLowerCase())));
  if (!doc.createdAt) doc.createdAt = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
  req.setBody(doc);
}
```

### Deployment-Skript

**deploy-sprocs.js:**
```javascript
async function upsertSproc(container, id, body) {
  try {
    await container.scripts.storedProcedure(id).replace({ id, body });
    console.log("replaced sproc:", id);
  } catch {
    await container.scripts.storedProcedures.create({ id, body });
    console.log("created sproc:", id);
  }
}

// Robuste Pfadangaben relativ zum Skriptstandort
const timelineDir = path.resolve(__dirname, '../timeline');
const pretriggersDir = path.resolve(__dirname, '../pretriggers/tasks');

for (const { id, body } of read(timelineDir)) {
  await upsertSproc(contTimeline, id, body);
}

for (const { id, body } of read(pretriggersDir)) {
  await contTasks.scripts.trigger(id).replace({ 
    id, body, 
    triggerType: "Pre", 
    triggerOperation: "All" 
  });
}
```

## Die Probleme und Lösungen

### Problem 1: API-Verwirrung mit Script-Namen
**Problem:** Cosmos DB Script API ist inkonsistent:
- Stored Procedures: `.storedProcedures` (plural) für create
- Aber: `.storedProcedure(id)` (singular) für replace

**Lösung:** Try-Catch Pattern mit replace→create fallback
```javascript
try {
  await container.scripts.storedProcedure(id).replace({ id, body });
} catch {
  await container.scripts.storedProcedures.create({ id, body });
}
```

### Problem 2: Wochenend-Regel für Fixed Tasks
**Problem:** Meetings (fixed:true) sollten überall platziert werden können, aber initiale Implementierung erlaubte keine Ausnahmen.

**Lösung:** Conditional Check in Schedule-Validierung
```javascript
var violatesSchedule = (task.kind==="work" && wknd) || (task.kind==="personal" && !wknd);
if (violatesSchedule && !(task.fixed === true)) continue;
```

### Problem 3: Carry-Over im Shift-Mechanismus
**Problem:** Was passiert, wenn ein Slot am Ende des Tages überschrieben wird und eine Task "herausfällt"?

**Lösung:** Shift-Logik mit intelligentem Carry-Over:
1. Speichere letzten Slot vor dem Shift
2. Verschiebe alle Slots nach rechts
3. Finde ersten legalen Slot im nächsten Tag
4. Übertrage Carry unter Beachtung der Schedule-Regeln
5. Fehler werfen, wenn kein Platz verfügbar

### Problem 4: Pfad-Probleme im Deploy-Skript
**Problem:** Relative Pfade schlugen fehl, wenn Skript aus verschiedenen Verzeichnissen aufgerufen wurde.

**Lösung:** Absoluter Pfad relativ zum Skript-Standort
```javascript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const timelineDir = path.resolve(__dirname, '../timeline');
```

### Problem 5: Connection String vs. Endpoint+Key
**Problem:** Plan sah separate COSMOS_ENDPOINT und COSMOS_KEY vor, aber Connection String ist flexibler.

**Lösung:** Umstellung auf COSMOS_CONNECTION_STRING
```javascript
const connectionString = process.env.COSMOS_CONNECTION_STRING;
const client = new CosmosClient(connectionString);
```

### Problem 6: Trigger Deployment
**Problem:** Trigger haben andere API als Stored Procedures:
- `triggerType: "Pre"`
- `triggerOperation: "All"`

**Lösung:** Separater upsert für Triggers mit korrekten Parametern
```javascript
await contTasks.scripts.trigger(id).replace({ 
  id, body, 
  triggerType: "Pre", 
  triggerOperation: "All" 
});
```

## Das Ergebnis

### Funktionierende Features
✅ AutoFill findet automatisch freie Slots unter Beachtung aller Regeln  
✅ Manuelle Platzierung mit intelligentem Schieben  
✅ Fixed Tasks können Regeln brechen (für Meetings)  
✅ Carry-Over in den nächsten Tag bei Slot-Überlauf  
✅ Automatische Task-Normalisierung via Pre-Trigger  
✅ Idempotentes Deployment via npm run deploy:sprocs  
✅ Atomare Operationen ohne Race Conditions  

### Performance-Vorteile
- **Keine Race Conditions**: Atomare Updates durch Stored Procedures
- **Weniger Roundtrips**: Logik läuft serverseitig
- **Optimierte Queries**: Single SELECT mit ORDER BY
- **Transaction Safety**: Cosmos DB garantiert ACID innerhalb der SP

### Code-Qualität
- **Minimalistisch**: Keine über-engineerte Logik
- **Robust**: Try-Catch mit graceful fallbacks
- **Wartbar**: Klare Separation Timeline vs. Tasks
- **Dokumentiert**: Inline-Kommentare erklären Business-Regeln

## Learnings

### 1. Stored Procedures sind nicht wie normale Funktionen
- Kein async/await innerhalb der SP (Callback-Hölle)
- Queries sind asynchron, aber man kann nicht darauf warten
- Rekursive Logik ist schwierig (Carry-Over-Limitation)

### 2. API-Inkonsistenzen sind real
- Singular vs. Plural bei Scripts
- Replace vs. Create mit unterschiedlichen Signaturen
- Trigger vs. Stored Procedures haben verschiedene APIs

### 3. Business-Regeln zentral halten lohnt sich
- Einmal definiert, überall konsistent
- Client-Code muss Regeln nicht kennen
- Änderungen an einem Ort (redeploy)

### 4. Fixed-Flag als Escape Hatch ist brilliant
- Erlaubt Ausnahmen ohne Regel-Logik zu verkomplizieren
- Meetings können überall hin, Tasks folgen Schedule
- Simple Boolean statt komplexes Permissions-System

### 5. Try-Catch für Idempotenz ist praktisch
- Upsert-Pattern via replace→create fallback
- Kein separates "exists?"-Check nötig
- Deploy-Skript kann beliebig oft laufen

### 6. Path Resolution ist kritisch
- `__dirname` in ES Modules braucht fileURLToPath
- Relative Pfade relativ zum Skript, nicht zum CWD
- `path.resolve` ist dein Freund

### 7. Cosmos DB kennt nur einen "Batch" pro SP
- SP kann nur Documents innerhalb der Partition modifizieren
- Cross-Partition Queries ja, aber Cross-Partition Writes nein
- Carry-Over in nächsten Tag ist technisch OK (gleiche userId)

## Code-Referenzen

### Deployment
```bash
npm run deploy:sprocs
```

### Verwendung in Azure Functions
```javascript
// AutoFill
const result = await container.scripts
  .storedProcedure('assignTaskToFirstFreeSlot')
  .execute(undefined, [userId, dateFrom, task]);

// Manual Assignment
const result = await container.scripts
  .storedProcedure('assignTaskToSpecificSlot')
  .execute(undefined, [userId, date, slotIdx, task]);
```

### Trigger wird automatisch ausgeführt
```javascript
// Pre-Trigger läuft bei jedem create/replace auf tasks
await tasksContainer.items.create(taskDoc);
// → taskNormalizeOnWrite wird automatisch aufgerufen
```

## Kontext für Außenstehende

### Was ist eine Stored Procedure?
Eine Stored Procedure ist eine Funktion, die **direkt in der Datenbank** läuft, nicht in deinem Client-Code. In Cosmos DB sind sie in JavaScript geschrieben und haben Zugriff auf die Collection-API.

**Vorteile:**
- Atomare Operationen (keine Race Conditions)
- Weniger Netzwerk-Traffic (Logik läuft am Datenspeicher)
- Transaction Safety (alles oder nichts)

**Nachteile:**
- Callback-basiert (kein async/await)
- Debugging ist schwieriger
- Partition-gebunden (nur Docs mit gleichem PK)

### Was ist ein Pre-Trigger?
Ein Pre-Trigger ist eine Funktion, die **automatisch vor jedem Write** ausgeführt wird. Wie ein Webhook, der auf DB-Ebene hängt.

**Use Case:** Validierung, Normalisierung, Default-Werte setzen

### Warum nicht alles im Client?
**Problem:** Race Conditions bei parallelen Updates
- Client 1 liest Tag, findet Slot 1 frei
- Client 2 liest Tag, findet Slot 1 frei
- Beide schreiben gleichzeitig → Slot 1 doppelt belegt

**Lösung:** Stored Procedure prüft und schreibt atomar
- SP 1 läuft, liest, schreibt Slot 1
- SP 2 läuft, liest, sieht Slot 1 belegt, nimmt Slot 2

### Warum Cosmos DB?
Cosmos DB ist Microsofts NoSQL-Datenbank mit:
- Globaler Verteilung (Multi-Region)
- Horizontale Skalierung
- SQL-ähnliche Query-Sprache
- Stored Procedures in JavaScript
- Integriert in Azure Functions

## Fazit

Die Implementierung der Stored Procedures war ein Kampf gegen API-Inkonsistenzen und die Callback-Hölle, aber das Ergebnis ist ein robustes, atomares System. Die wichtigste Erkenntnis: **Serverseitige Logik braucht serverseitiges Denken.** Nicht jede Client-Logik lässt sich 1:1 in eine SP übersetzen, aber wo es klappt, gewinnt man Performance und Konsistenz.

**Die drei goldenen Regeln:**
1. Halte SPs minimalistisch (Komplexität → Client)
2. Nutze Triggers für Normalisierung, nicht Validierung
3. Deploy-Skripte sind Teil deines Codes (idempotent!)

---

**Relevante Dateien:**
- `database/timeline/assignTaskToFirstFreeSlot.js`
- `database/timeline/assignTaskToSpecificSlot.js`
- `database/pretriggers/tasks/taskNormalizeOnWrite.js`
- `database/infra/deploy-sprocs.js`
- `Plans/Plan-stored-Procedure.md`
- `documentation/arc42.md` (ADR-005)
