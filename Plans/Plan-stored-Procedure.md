Gut. Wir sind durch den Sumpf, die Stiefel stinken, aber das System steht. Hier ist deine **finale, einmal-alles-drin-Zusammenfassung** mit leicht gestrafftem Code. Minimalistisch, prügelstabil, ohne Feingefrickel.

---

# Regeln (knapp und final)

1. **Zeitblöcke**: 3 Slots pro Tag

* `AM` 09:00–12:30, `PM` 13:30–17:00, `EV` 19:30–23:00
* Abend ist für Auto-Planung tabu.

2. **Planungslogik**

* Auto-Fill:

  * `work` nur Mo–Fr.
  * `personal` nur Sa–So.
  * `meeting` wird nie auto-geplant (du setzt es manuell und `fixed:true`).
* Manuell:

  * Alles erlaubt, **nur** Regelbruch gegenüber Wochentag ist zulässig, **wenn `fixed:true`**.

3. **Meeting & Fixed**

* `meeting` = Task mit `kind:"meeting"`, `fixed:true`, blockt den gesamten Slot.

4. **Retro (Variante A)**

* Vergangenheit wird nicht in der Timeline rumgeschoben.
* Du setzt am Task `performed.date`/`performed.slotIdx` und optional `completedAt`.
* Reporting nimmt `performed` vor `planned`.

---

# Datenmodell (unverändert schlank)

## Container `tasks` (PK `/userId`)

```json
{
  "id": "task_123",
  "type": "task",
  "userId": "u_merlin",
  "kind": "work",              // "work" | "personal" | "meeting"
  "title": "CodexMiroir Sprint Block",
  "description": "3,5h Fokusblock",
  "notes": [{ "at": "2025-10-01T08:21:00Z", "text": "Edgecase Weekend" }],
  "tags": ["codexmiroir"],
  "project": { "id": "proj_codexmiroir", "name": "CodexMiroir" },
  "contact": { "name": "Marina", "email": "marina@example.com" },
  "external": { "devOpsUrl": null, "calendarEventId": null },
  "deadline": null,
  "fixed": false,
  "status": "open",
  "priority": 3,
  "checklist": [],
  "worklog": [],
  "planned":   { "date": "2025-10-03", "slotIdx": 0 },  // optional
  "performed": { "date": "2025-10-03", "slotIdx": 0 },  // optional
  "completedAt": null,
  "createdAt": "2025-10-01T13:00:00Z",
  "updatedAt": "2025-10-01T13:00:00Z"
}
```

## Container `timeline` (PK `/userId`, ein Doc pro Tag)

```json
{
  "id": "2025-10-01",
  "type": "day",
  "userId": "u_merlin",
  "date": "2025-10-01",
  "weekday": 3,        // 1=Mo … 7=So
  "tz": "Europe/Berlin",
  "slots": [
    { "idx": 0, "label": "AM", "startLocal": "2025-10-01T09:00:00+02:00", "endLocal": "2025-10-01T12:30:00+02:00", "locked": false, "manualOnly": false, "assignment": { "taskId": null, "kind": null, "source": null } },
    { "idx": 1, "label": "PM", "startLocal": "2025-10-01T13:30:00+02:00", "endLocal": "2025-10-01T17:00:00+02:00", "locked": false, "manualOnly": false, "assignment": { "taskId": null, "kind": null, "source": null } },
    { "idx": 2, "label": "EV", "startLocal": "2025-10-01T19:30:00+02:00", "endLocal": "2025-10-01T23:00:00+02:00", "locked": true,  "manualOnly": true,  "assignment": { "taskId": null, "kind": null, "source": null } }
  ],
  "meta": { "autoFillEnabled": true, "notes": [] }
}
```

---

# Stored Procedures: was rein kommt

Ziel: so wenig wie möglich und alles Regelhafte zentral.

## SP 1: `assignTaskToFirstFreeSlot`

Auto-Fill nach Regeln (work nur Mo–Fr, personal nur Sa–So, Abend tabu).

```js
function assignTaskToFirstFreeSlot(userId, dateFrom, task) {
  const c = getContext(), coll = c.getCollection(), res = c.getResponse();
  if (!task || !task.id || !task.kind) throw new Error("task.id & task.kind required");
  task._source = "auto";
  const q = { query:
    "SELECT * FROM c WHERE c.type='day' AND c.userId=@u AND c.id>=@d ORDER BY c.id ASC",
    parameters: [{name:"@u",value:userId},{name:"@d",value:dateFrom}]
  };
  coll.queryDocuments(coll.getSelfLink(), q, function(err, docs){
    if (err) throw err; if (!docs || !docs.length) throw new Error("No days");
    for (var di=0; di<docs.length; di++){
      var day = docs[di], wknd = day.weekday >= 6;
      if ((task.kind==="work" && wknd) || (task.kind==="personal" && !wknd)) continue;
      for (var i=0; i<day.slots.length; i++){
        var s = day.slots[i];
        if (s.manualOnly || s.locked) continue;
        if (!s.assignment || !s.assignment.taskId){
          s.assignment = { taskId: task.id, kind: task.kind, source: "auto" };
          return coll.replaceDocument(day._self, day, function(e){
            if (e) throw e;
            res.setBody({ ok:true, date: day.id, slotIdx: s.idx, taskId: task.id });
          });
        }
      }
    }
    throw new Error("No compliant free slot found");
  });
}
```

## SP 2: `assignTaskToSpecificSlot`

Manuelles Setzen inkl. Schieben. Verstößt der Task gegen Werktag/Wochenende, dann nur erlaubt, wenn `fixed:true`.

```js
function assignTaskToSpecificSlot(userId, date, slotIdx, task) {
  const c = getContext(), coll = c.getCollection(), res = c.getResponse();
  const q = { query:
    "SELECT * FROM c WHERE c.type='day' AND c.userId=@u AND c.id=@d",
    parameters: [{name:"@u",value:userId},{name:"@d",value:date}]
  };
  task._source = task._source || "manual";
  coll.queryDocuments(coll.getSelfLink(), q, function(err, docs){
    if (err) throw err; if (!docs || !docs.length) throw new Error("Day not found");
    var day = docs[0], s = day.slots.filter(x=>x.idx===slotIdx)[0];
    if (!s) throw new Error("Invalid slot");
    var wknd = day.weekday >= 6, manual = task._source !== "auto";
    var violates = (task.kind==="work" && wknd) || (task.kind==="personal" && !wknd);

    if (s.manualOnly && !manual) throw new Error("Slot manualOnly");
    if (s.locked && !manual) throw new Error("Slot locked");
    if (violates && !(manual && task.fixed === true)) throw new Error("Day rule violation");

    // Schieben, wenn belegt
    if (s.assignment && s.assignment.taskId) shiftFollowing(day, slotIdx);

    // Belegen
    s.assignment = { taskId: task.id, kind: task.kind || "work", source: manual ? "manual" : "auto" };
    coll.replaceDocument(day._self, day, function(e){ if (e) throw e; res.setBody({ ok:true }); });
  });

  function shiftFollowing(day, fromIdx){
    // simple innerhalb des Tages, carry in nächsten Tag in ersten freien legalen Slot
    var carry = day.slots[day.slots.length-1].assignment;
    for (var i=day.slots.length-1; i>fromIdx; i--) day.slots[i].assignment = day.slots[i-1].assignment;
    day.slots[fromIdx].assignment = null;
    if (carry && carry.taskId){
      var nd = nextDate(day.id);
      const q2 = { query:
        "SELECT * FROM c WHERE c.type='day' AND c.userId=@u AND c.id=@d",
        parameters: [{name:"@u",value:userId},{name:"@d",value:nd}]
      };
      coll.queryDocuments(coll.getSelfLink(), q2, function(err, docs){
        if (err) throw err; if (!docs || !docs.length) throw new Error("Next day not found");
        var next = docs[0];
        for (var j=0; j<next.slots.length; j++){
          var ns = next.slots[j], wk = next.weekday>=6;
          if (ns.manualOnly || ns.locked) continue;
          if (wk && carry.kind==="work") continue;
          if (!wk && carry.kind==="personal") continue;
          if (!ns.assignment || !ns.assignment.taskId){
            ns.assignment = carry;
            return coll.replaceDocument(next._self, next, function(e){ if (e) throw e; });
          }
        }
        throw new Error("No place for carry");
      });
    }
  }
  function nextDate(d){ var T=new Date(d+"T00:00:00Z"); T.setUTCDate(T.getUTCDate()+1); return T.toISOString().slice(0,10); }
}
```

## Optionaler Pre-Trigger `taskNormalizeOnWrite`

Setzt Defaults und `updatedAt`:

```js
function taskNormalizeOnWrite(){
  const req = getContext().getRequest();
  const doc = req.getBody();
  doc.type = doc.type || "task";
  doc.status = doc.status || "open";
  doc.tags = Array.from(new Set((doc.tags||[]).map(t=>String(t).toLowerCase())));
  if (!doc.createdAt) doc.createdAt = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
  req.setBody(doc);
}
```

---

# Setup-Skript zum Hinterlegen/Updaten der Stored Procedures

Pack das in dein Repo unter `infra/deploy-sprocs.mjs`. Es lädt alle `.js` aus `storedprocs/` und `pretriggers/` hoch, **idempotent** per `upsert` bzw. `replace`.

```js
// infra/deploy-sprocs.mjs
import { CosmosClient } from "@azure/cosmos";
import fs from "node:fs";
import path from "node:path";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const dbName = process.env.COSMOS_DB || "codexmiroir";
const timeline = process.env.COSMOS_TIMELINE || "timeline";
const tasks = process.env.COSMOS_TASKS || "tasks";

const client = new CosmosClient({ endpoint, key });

async function upsertSproc(container, id, body){
  try {
    const s = container.scripts.storedProcedure(id);
    await s.replace({ id, body });
    console.log("replaced sproc:", id);
  } catch {
    await container.scripts.storedProcedures.create({ id, body });
    console.log("created sproc:", id);
  }
}
async function upsertTrigger(container, id, body, type, triggerOperation){
  try {
    const t = container.scripts.trigger(id);
    await t.replace({ id, body, triggerType: type, triggerOperation });
    console.log("replaced trigger:", id);
  } catch {
    await container.scripts.triggers.create({ id, body, triggerType: type, triggerOperation });
    console.log("created trigger:", id);
  }
}

function read(dir){
  return fs.readdirSync(dir)
    .filter(f=>f.endsWith(".js"))
    .map(f=>({ id: path.parse(f).name, body: fs.readFileSync(path.join(dir,f), "utf8") }));
}

(async()=>{
  const db = client.database(dbName);
  const contTimeline = db.container(timeline);
  const contTasks = db.container(tasks);

  // Stored Procedures
  for (const {id, body} of read("./storedprocs/timeline")) {
    await upsertSproc(contTimeline, id, body);
  }
  // Pre-Triggers
  for (const {id, body} of read("./pretriggers/tasks")) {
    await upsertTrigger(contTasks, id, body, "Pre", "All");
  }
  console.log("done.");
})().catch(e=>{ console.error(e); process.exit(1); });
```

Dateistruktur im Repo:

```
storedprocs/
  timeline/
    assignTaskToFirstFreeSlot.js
    assignTaskToSpecificSlot.js
pretriggers/
  tasks/
    taskNormalizeOnWrite.js
infra/
  deploy-sprocs.mjs
```

---

# Azure Functions: was dort liegt

Funktionaler Klebstoff. Dünn halten, Regeln leben in SPs.

1. **HTTP `assignToSlot`**

* Body: `{ userId, date, slotIdx, task: { id, kind, fixed }, source: "manual" }`
* Ruft `assignTaskToSpecificSlot` auf, gibt Ergebnis durch.

2. **HTTP `autoFill`**

* Body: `{ userId, dateFrom, task: { id, kind } }`
* Ruft `assignTaskToFirstFreeSlot` auf.

3. **TIMER `ensureDays`**

* Legt die Day-Dokumente für die nächsten N Tage an (AM/PM normal, EV locked+manualOnly).
* Optional: schreibt `weekday`/`tz`.

Minimalbeispiel hattest du schon. Lass es so, es ist ausreichend.

---

# Azure Cosmos DB einrichten

1. **Account & DB**

* Erstelle Cosmos DB (SQL API), DB `codexmiroir`.

2. **Container anlegen**

* `tasks`: PK `/userId`, optional Unique Key auf `["/userId","/external/devOpsUrl"]`.
* `timeline`: PK `/userId`.

3. **Indexing**

* Standard reicht. Optional Composite für `tasks`:

  * `(status ASC, deadline ASC)`
  * `(kind ASC, fixed ASC)`

4. **Scripts deployen**

* Environment-Variablen setzen:

  * `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DB=codexmiroir`, `COSMOS_TIMELINE=timeline`, `COSMOS_TASKS=tasks`
* `node infra/deploy-sprocs.mjs` ausführen. Fertig.

---

# Kleine Vereinfachungen, die ich eingebaut habe

* Eine Auto-SP (`assignTaskToFirstFreeSlot`) statt unterschiedliche Varianten. Art des Tasks steuert den erlaubten Tag.
* In `assignTaskToSpecificSlot` ist die Wochenregel ein Zweizeiler, der nur `fixed:true` als Ausnahmeschalter akzeptiert.
* Schieben bleibt **tageslokal + carry in den nächsten Tag** ohne Heroismus. Wenn kein Platz, Fehler. Keine mehrtägigen Domino-Orgien.
* Retro bleibt ausschließlich im Task (`performed`), Timeline wird nicht rückwirkend frisiert. Weniger Magie, mehr Wahrheit.

---

Das ist dein finales Setup. Drei Slots, klare Regeln, minimale SPs, Functions als dünner API-Mantel, ein Deployment-Skript, das den Krempel versioniert und aktualisiert. Wenn du jetzt noch was aufbohrst, dann bitte später und mit Kaffee. Für den Anfang ist das Ding erstaunlich vernünftig.
