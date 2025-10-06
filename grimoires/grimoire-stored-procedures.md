# Cloud Grimoire #2 – Die Beschwörung der Atomaren Zeitmaschine

👁️ **Szene / Einstieg**  
In der Dunkelheit der verteilten Systeme lauerte ein Dämon: die **Race Condition**. Zwei Clients, gleichzeitig lesend, gleichzeitig schreibend – und plötzlich waren zwei Tasks im selben Slot. Ein Paradoxon der Zeit. Die Lösung? Die Macht in die Datenbank selbst zu verlagern, wo Atome nicht gespalten werden können. **Stored Procedures** – JavaScript, das nicht im Browser, sondern im Herzen von Cosmos DB pulsiert.

⚡ **Der Bruch / das Problem**  
Die Vision war klar: Eine Timeline mit drei Slots pro Tag (Morgen, Nachmittag, Abend). Tasks sollten automatisch platziert werden – **work** nur Montag bis Freitag, **personal** nur am Wochenende. Meetings sollten überall hin dürfen. Alles atomar, alles konsistent.

Doch die Realität war ein Sumpf aus Inkonsistenzen:

**Das API-Rätsel der Singular-Plural-Zwietracht:**  
Cosmos DB spricht in Rätseln. Um eine Stored Procedure zu **ersetzen**, ruft man `.storedProcedure(id).replace()` auf (Singular). Um sie zu **erstellen**, braucht es `.storedProcedures.create()` (Plural). Ein Buchstabe Unterschied, eine Stunde Debugging.

**Die Callback-Hölle ohne Ende:**  
Stored Procedures kennen kein `async/await`. Sie sind Relikte aus einer Zeit, als Callbacks König waren. Queries sind asynchron, Writes sind asynchron – aber man kann nicht darauf warten. Man verschachtelt, man betet, man hofft.

**Das Carry-Over-Dilemma:**  
Was passiert, wenn ein Slot am Ende des Tages überschrieben wird? Die verdrängte Task fällt heraus – wohin? In den nächsten Tag. Aber was, wenn der nächste Tag voll ist? Was, wenn die Task gegen Wochenend-Regeln verstößt? Ein Dominostein, der eine Kette auslösen könnte – aber wir wollten keine mehrtägige Domino-Orgie.

**Das Fixed-Flag-Problem:**  
Meetings sollten überall platziert werden können. Work-Tasks nur werktags, Personal-Tasks nur am Wochenende. Aber Meetings sind auch Work. Eine Ausnahme brauchte eine Regel – und die Regel durfte nicht komplex werden.

🔍 **Die Entdeckung / Erkenntnis**  
Die Lösung lag in vier magischen Beschwörungen:

**Beschwörung 1: Das Upsert-Ritual**  
Statt zu prüfen ob eine Stored Procedure existiert, versuch sie zu ersetzen. Schlägt das fehl, erstelle sie. Try-Catch als Idempotenz-Pattern:

```javascript
async function upsertSproc(container, id, body) {
  try {
    await container.scripts.storedProcedure(id).replace({ id, body });
  } catch {
    await container.scripts.storedProcedures.create({ id, body });
  }
}
```

Ein Deployment-Skript, das beliebig oft laufen kann. Git ist die Versionierung, nicht die Datenbank.

**Beschwörung 2: Der Fixed-Flag Escape Hatch**  
Eine einzige Boolean als Ausnahme-Ventil. Meetings setzen `fixed: true` und dürfen Regeln brechen:

```javascript
var violatesSchedule = (task.kind==="work" && wknd) || (task.kind==="personal" && !wknd);
if (violatesSchedule && !(task.fixed === true)) continue;
```

Eleganz durch Simplizität. Kein komplexes Permission-System, nur ein Flag.

**Beschwörung 3: Der intelligente AutoFill**  
Eine Stored Procedure, die alle Tage ab einem Datum durchsucht, Regeln prüft, und den ersten freien Slot atomar belegt:

```javascript
function assignTaskToFirstFreeSlot(userId, dateFrom, task) {
  const q = {
    query: "SELECT * FROM c WHERE c.type='day' AND c.userId=@u AND c.id>=@d ORDER BY c.id ASC",
    parameters: [{name:"@u",value:userId},{name:"@d",value:dateFrom}]
  };
  coll.queryDocuments(coll.getSelfLink(), q, function(err, docs){
    for (var di=0; di<docs.length; di++){
      var day = docs[di], wknd = day.weekday >= 6;
      if ((task.kind==="work" && wknd) || (task.kind==="personal" && !wknd)) {
        if (!(task.fixed === true)) continue;
      }
      for (var i=0; i<day.slots.length; i++){
        var s = day.slots[i];
        if (s.manualOnly || s.locked) continue;
        if (!s.assignment || !s.assignment.taskId){
          s.assignment = { taskId: task.id, kind: task.kind, source: "auto" };
          return coll.replaceDocument(day._self, day, callback);
        }
      }
    }
  });
}
```

Ein Query. Eine Iteration. Eine atomare Schreiboperation. Keine Race Condition.

**Beschwörung 4: Das Shift-und-Carry-Ballett**  
Wenn ein Slot manuell überschrieben wird, tanzen die Tasks nach rechts. Die letzte fällt heraus und sucht sich den ersten legalen Platz im nächsten Tag:

```javascript
function shiftFollowing(day, fromIdx){
  var carry = day.slots[day.slots.length-1].assignment;
  for (var i=day.slots.length-1; i>fromIdx; i--) {
    day.slots[i].assignment = day.slots[i-1].assignment;
  }
  day.slots[fromIdx].assignment = null;
  
  if (carry && carry.taskId){
    // Finde ersten freien, legalen Slot im nächsten Tag
    var violates = (wk && carry.kind==="work") || (!wk && carry.kind==="personal");
    if (violates && !(carry.fixed === true)) continue;
    if (!ns.assignment) {
      ns.assignment = carry;
      return coll.replaceDocument(next._self, next, callback);
    }
  }
}
```

Ein lokales Schieben, ein intelligenter Übertrag, ein Fehler bei Unmöglichkeit. Keine endlosen Dominoketten.

**Beschwörung 5: Der Pre-Trigger als Wächter**  
Ein Pre-Trigger normalisiert jede Task vor dem Schreiben – automatisch, unsichtbar, zuverlässig:

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

Defaults setzen, Tags normalisieren, Timestamps pflegen – alles auf DB-Ebene. Der Client kann es vergessen, die Datenbank erinnert sich.

**Die Deployment-Magie:**  
Ein Skript, das alle `.js`-Dateien aus `database/timeline/` und `database/pretriggers/tasks/` liest und hochlädt. Idempotent, wiederholbar, versioniert:

```javascript
const timelineDir = path.resolve(__dirname, '../timeline');
for (const { id, body } of read(timelineDir)) {
  await upsertSproc(contTimeline, id, body);
}
```

Ein Befehl: `npm run deploy:sprocs`. Die Magie entfaltet sich.

✨ **Die neue Rune im Grimoire**  
_„Wo zwei Clients gleichzeitig schreiben, herrscht Chaos. Aber in der Datenbank, wo JavaScript atomar wird, gibt es nur eine Wahrheit. Stored Procedures sind Callbacks ohne Gnade – aber sie garantieren Konsistenz, wo Client-Code nur hoffen kann. Ein Fixed-Flag ist ein Escape Hatch, kein Hack. Und der Carry-Over endet, wo kein Platz ist – keine endlosen Ketten, nur ehrliche Fehler."_

**Die Essenz der Beschwörung:**
- ⚛️ **Atomarität durch Stored Procedures**: Keine Race Conditions, keine Hoffnung – nur Garantien
- 🔄 **Try-Catch als Idempotenz**: Replace→Create fallback statt Existence-Checks
- 🚪 **Fixed als Escape Hatch**: Boolean statt Permission-Matrix
- 🎯 **AutoFill mit einem Query**: ORDER BY ASC, erste Match, atomarer Write
- 💃 **Shift lokal, Carry intelligent**: Ein Tag schiebt, nächster Tag nimmt – oder Fehler
- 🛡️ **Pre-Trigger als Wächter**: Normalisierung auf DB-Ebene, nicht im Client
- 📦 **Git als Versionierung**: Deploy-Skript für Scripts, nicht DB-Metadaten
- 🔌 **Connection String statt Endpoint+Key**: Flexibler, robuster

**Das Ergebnis – Die manifestierte Vision:**

✨ **AutoFill findet automatisch** den ersten freien Slot unter Beachtung aller Regeln  
⚡ **Manuelle Platzierung verschiebt** Tasks intelligent mit Carry-Over  
🎯 **Fixed Tasks brechen Regeln** (für Meetings, ohne alles zu verkomplizieren)  
🔒 **Atomare Operationen** eliminieren Race Conditions vollständig  
🚀 **Minimale Roundtrips** – Logik läuft am Datenspeicher  
📝 **Automatische Normalisierung** via Pre-Trigger bei jedem Write  
🔁 **Idempotentes Deployment** – `npm run deploy:sprocs` beliebig oft  

Das System läuft. Atomar. Konsistent. Minimalistisch.

🌙 **Ausblick / offenes Ende**  
Die Stored Procedures tanzen nun im Herzen von Cosmos DB. Sie prüfen, sie schreiben, sie garantieren. Aber eine Frage bleibt unbeantwortet: Können wir die **Shift-Logik über mehrere Tage** ausdehnen, ohne in die Domino-Orgie zu fallen? Ein Carry-Over-Chain, der intelligent abbricht? Oder ist die lokale Beschränkung die wahre Weisheit?

Und was ist mit **Optimistic Locking**? Cosmos DB kennt ETags. Könnten wir Konflikte noch feiner auflösen, noch präziser reagieren? Die nächste Beschwörung wartet bereits im Code...

**Eine andere Frage lauert im Nebel:** Was, wenn wir die **Business-Regeln versionieren** wollen? Work-Tasks nur Mo-Fr – aber was, wenn das ändern muss? Eine Stored Procedure ist Code, aber sie lebt in der Datenbank. Ein Deployment ist ein Commit. Aber was ist mit Rollbacks? Was ist mit A/B-Testing von Regeln?

Die Zeitmaschine läuft. Aber sie hat Geheimnisse, die noch nicht alle gelüftet sind.

---

**Links & Referenzen:**
- [Cosmos DB Stored Procedures](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-write-stored-procedures-triggers-udfs) – Die offizielle Dokumentation
- [Cosmos DB Pre-Triggers](https://learn.microsoft.com/en-us/azure/cosmos-db/sql/how-to-use-stored-procedures-triggers-udfs#pre-triggers) – Trigger-Magie erklärt
- [ACID in Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/database-transactions-optimistic-concurrency) – Warum Stored Procedures atomar sind
- [Learning Document: Stored Procedures](../learning/stored-procedures.md) – Die vollständige technische Dokumentation

_Geschrieben im CodexMiroir, wo Zeit in Slots zerteilt wird und die Datenbank die Wahrheit bewahrt._
