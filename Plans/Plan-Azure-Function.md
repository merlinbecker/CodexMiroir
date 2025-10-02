Stimmt. Ich hab dir die Funktionskleber unterschlagen. Hier ist der fehlende Azure-Functions-Code, fertig zum Einwerfen. Prosa mit leichtem Augenrollen, Code nüchtern und einsatzbereit.

---

# Projektstruktur (minimal)

```
/src/functions/
  assignToSlot.js
  autoFill.js
  ensureDaysTimer.js
/package.json
/local.settings.json        # nur lokal
```

---

# `package.json`

```json
{
  "name": "codexmiroir-functions",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "dependencies": {
    "@azure/functions": "^4.4.0",
    "@azure/cosmos": "^3.17.5"
  }
}
```

---

# `local.settings.json` (nur lokal, nicht commiten)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_ENDPOINT": "https://<your-account>.documents.azure.com:443/",
    "COSMOS_KEY": "<secret>",
    "COSMOS_DB": "codexmiroir",
    "COSMOS_TIMELINE": "timeline",
    "COSMOS_TASKS": "tasks",
    "USERS_CSV": "u_merlin",
    "DAY_HORIZON": "30"
  }
}
```

---

# Gemeinsamer Cosmos-Client (Snippet, optional)

Wenn du Code duplizieren hasst:

```js
// src/functions/_cosmos.js
import { CosmosClient } from "@azure/cosmos";

export function cosmos() {
  const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY
  });
  const db = client.database(process.env.COSMOS_DB);
  return {
    client,
    db,
    tasks: db.container(process.env.COSMOS_TASKS),
    timeline: db.container(process.env.COSMOS_TIMELINE)
  };
}
```

Ich nutze unten der Einfachheit halber direkt den Client in jeder Datei. Du kannst das natürlich aufräumen, wenn du dringend Architektur spielen willst.

---

# HTTP: `assignToSlot`

Setzt einen Task manuell in einen Slot und nutzt die Stored Procedure `assignTaskToSpecificSlot`.

```js
// src/functions/assignToSlot.js
import { app } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";

app.http("assignToSlot", {
  methods: ["POST"],
  route: "timeline/assign",
  authLevel: "function"
}, async (req, ctx) => {
  try {
    const body = await req.json();
    const { userId, date, slotIdx, task, source } = body || {};
    if (!userId || !date || typeof slotIdx !== "number" || !task || !task.id) {
      return { status: 400, jsonBody: { error: "Missing parameters" } };
    }

    // Kennzeichne Quelle für SP-Regelprüfung
    task._source = source === "auto" ? "auto" : "manual";

    const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const db = client.database(process.env.COSMOS_DB);
    const cont = db.container(process.env.COSMOS_TIMELINE);

    const sproc = cont.scripts.storedProcedure("assignTaskToSpecificSlot");
    const { resource } = await sproc.execute(userId, [userId, date, slotIdx, task]);

    return { status: 200, jsonBody: resource };
  } catch (e) {
    ctx.log.error("assignToSlot error:", e);
    return { status: 409, jsonBody: { error: String(e.message || e) } };
  }
});
```

---

# HTTP: `autoFill`

Plant automatisch in den nächsten passenden freien Slot gemäß Regeln. Ruft `assignTaskToFirstFreeSlot`.

```js
// src/functions/autoFill.js
import { app } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";

app.http("autoFill", {
  methods: ["POST"],
  route: "timeline/autofill",
  authLevel: "function"
}, async (req, ctx) => {
  try {
    const body = await req.json();
    const { userId, dateFrom, task } = body || {};
    if (!userId || !dateFrom || !task || !task.id || !task.kind) {
      return { status: 400, jsonBody: { error: "Missing parameters" } };
    }

    task._source = "auto";

    const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const db = client.database(process.env.COSMOS_DB);
    const cont = db.container(process.env.COSMOS_TIMELINE);

    const sproc = cont.scripts.storedProcedure("assignTaskToFirstFreeSlot");
    const { resource } = await sproc.execute(userId, [userId, dateFrom, task]);

    return { status: 200, jsonBody: resource };
  } catch (e) {
    ctx.log.error("autoFill error:", e);
    return { status: 409, jsonBody: { error: String(e.message || e) } };
  }
});
```

---

# TIMER: `ensureDaysTimer`

Legt Day-Dokumente für die nächsten N Tage an. Abend ist `locked+manualOnly`.

```js
// src/functions/ensureDaysTimer.js
import { app } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";

app.timer("ensureDaysTimer", {
  // Täglich um 04:00 UTC (für Berlin reicht das locker)
  schedule: "0 0 4 * * *"
}, async (_tick, ctx) => {
  const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
  const db = client.database(process.env.COSMOS_DB);
  const cont = db.container(process.env.COSMOS_TIMELINE);

  const users = (process.env.USERS_CSV || "").split(",").map(s => s.trim()).filter(Boolean);
  const horizonDays = parseInt(process.env.DAY_HORIZON || "30", 10);

  for (const userId of users) {
    for (let i = 0; i < horizonDays; i++) {
      const d = new Date();
      // wir nutzen UTC-Datumsarithmetik; Slot-Lokalisierung ist optional
      d.setUTCDate(d.getUTCDate() + i);
      const dateId = d.toISOString().slice(0, 10);
      const weekday = ((d.getUTCDay() + 6) % 7) + 1; // Mo=1..So=7

      const doc = {
        id: dateId,
        type: "day",
        userId,
        date: dateId,
        weekday,
        tz: "Europe/Berlin",
        slots: [
          mkSlot(0, "AM", false, false),
          mkSlot(1, "PM", false, false),
          mkSlot(2, "EV", true,  true)
        ],
        meta: { autoFillEnabled: true, notes: [] }
      };

      try {
        await cont.items.create(doc, { disableAutomaticIdGeneration: true });
        ctx.log(`Created day ${dateId} for ${userId}`);
      } catch (e) {
        // 409 Conflict → existiert bereits → ignorieren
        if (e.code !== 409) ctx.log.warn(`ensureDays: ${dateId} ${userId} -> ${e.message}`);
      }
    }
  }

  function mkSlot(idx, label, locked, manualOnly) {
    return {
      idx, label,
      startLocal: null,
      endLocal: null,
      locked,
      manualOnly,
      assignment: { taskId: null, kind: null, source: null }
    };
  }
});
```

---

# Reminder: ENV-Variablen in der Function App

In der Function App unter „Configuration“ setzen:

* `COSMOS_ENDPOINT`
* `COSMOS_KEY`
* `COSMOS_DB=codexmiroir`
* `COSMOS_TIMELINE=timeline`
* `COSMOS_TASKS=tasks`
* `USERS_CSV=u_merlin`
* `DAY_HORIZON=30`

---

# Ja, das deckt alles ab

* Regeln sind in den Stored Procedures verankert, nicht im Funktions-Kleber.
* Azure Functions rufen nur SPs auf und erzeugen Day-Docs.
* Cosmos-Setup: zwei Container, PK `/userId`.
* Optionaler Pre-Trigger für Task-Normalisierung kannst du weiterverwenden, musst du aber nicht.

Wenn du trotzdem anfängst, Business-Tasks sonntags automatisch einzuplanen, ist das jetzt reine Absicht.
