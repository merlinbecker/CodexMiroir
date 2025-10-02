/**
 * Weist eine Aufgabe dem ersten passenden freien Slot eines Benutzers ab einem bestimmten Datum zu.
 *
 * - Sucht alle Tage ab `dateFrom` für den Nutzer `userId`.
 * - Überspringt Wochenenden für Arbeitsaufgaben und Werktage für private Aufgaben.
 * - Findet den ersten freien Slot, der nicht gesperrt oder manuell ist.
 * - Weist die Aufgabe diesem Slot zu und speichert die Änderung.
 * - Gibt das Ergebnis mit Datum, Slot-Index und Task-ID zurück.
 * - Löst Fehler aus, wenn keine passenden Tage oder Slots gefunden werden.
 */

function assignTaskToFirstFreeSlot(userId, dateFrom, task) {
  const c = getContext(), coll = c.getCollection(), res = c.getResponse();
  if (!task || !task.id || !task.kind) throw new Error("task.id & task.kind required");
  task._source = "auto";
  // Query: Alle Tage ab dateFrom für den Nutzer, aufsteigend sortiert
  const q = { query:
    "SELECT * FROM c WHERE c.type='day' AND c.userId=@u AND c.id>=@d ORDER BY c.id ASC",
    parameters: [{name:"@u",value:userId},{name:"@d",value:dateFrom}]
  };
  coll.queryDocuments(coll.getSelfLink(), q, function(err, docs){
    if (err) throw err;
    if (!docs || !docs.length) throw new Error("No days");
    for (var di=0; di<docs.length; di++){
      var day = docs[di], wknd = day.weekday >= 6; // Samstag=6, Sonntag=7
      // Arbeitsaufgaben werden an Wochenenden übersprungen, private an Werktagen
      // AUSNAHME: Feste Termine (task.fixed === true) können überall hin
      var violatesSchedule = (task.kind==="work" && wknd) || (task.kind==="personal" && !wknd);
      if (violatesSchedule && !(task.fixed === true)) continue;
      for (var i=0; i<day.slots.length; i++){
        var s = day.slots[i];
        // Slot überspringen, wenn nur manuell belegbar oder gesperrt
        if (s.manualOnly || s.locked) continue;
        // Slot ist frei, wenn keine Zuweisung vorhanden ist
        if (!s.assignment || !s.assignment.taskId){
          s.assignment = { 
            taskId: task.id, 
            taskTitle: task.title || task.id,
            kind: task.kind, 
            source: "auto" 
          };
          // Dokument aktualisieren und Ergebnis zurückgeben
          return coll.replaceDocument(day._self, day, function(e){
            if (e) throw e;
            res.setBody({ ok:true, date: day.id, slotIdx: s.idx, taskId: task.id });
          });
        }
      }
    }
    // Kein passender Slot gefunden
    throw new Error("No compliant free slot found");
  });
}