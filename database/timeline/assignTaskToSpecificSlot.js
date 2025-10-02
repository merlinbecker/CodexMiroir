/**
 * Weist eine Aufgabe einem bestimmten Slot eines Tages für einen Nutzer zu.
 *
 * - Sucht den Tag für den Nutzer und das angegebene Datum.
 * - Prüft, ob der Slot existiert und ob die Zuweisung erlaubt ist (z.B. Wochenend-/Werktagsregeln, manuell/automatisch).
 * - Falls der Slot bereits belegt ist, werden die Aufgaben im Tag nach hinten verschoben (shiftFollowing), ggf. mit Übertrag in den nächsten Tag.
 * - Weist die Aufgabe dem Slot zu und speichert die Änderung.
 * - Löst Fehler aus, wenn Bedingungen verletzt werden oder kein Platz für Übertrag ist.
 */
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
    if (violates && !(manual && task.fixed === true)) {
      throw new Error("Day rule violation: kind=" + task.kind + ", weekend=" + wknd + ", manual=" + manual + ", fixed=" + task.fixed);
    }

    // Schieben, wenn belegt
    if (s.assignment && s.assignment.taskId) shiftFollowing(day, slotIdx);

    // Belegen
    s.assignment = { 
      taskId: task.id, 
      taskTitle: task.title || task.id,
      kind: task.kind || "work", 
      source: manual ? "manual" : "auto" 
    };
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
          // Prüfe Schedule-Verletzung, aber erlaube es für feste Termine
          var violatesCarrySchedule = (wk && carry.kind==="work") || (!wk && carry.kind==="personal");
          if (violatesCarrySchedule && !(carry.fixed === true)) continue;
          if (!ns.assignment || !ns.assignment.taskId){
            ns.assignment = carry;
            return coll.replaceDocument(next._self, next, function(e){ if (e) throw e; });
          }
        }
        throw new Error("No place for carry");
      });
    }
  }
  // Liefert das nächste Datum im Format YYYY-MM-DD
  function nextDate(d){ var T=new Date(d+"T00:00:00Z"); T.setUTCDate(T.getUTCDate()+1); return T.toISOString().slice(0,10); }
}
