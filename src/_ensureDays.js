// Stellt sicher, dass Day-Dokumente bis zum angegebenen Datum existieren
import { cosmos } from "./_cosmos.js";

/**
 * Stellt sicher, dass Day-Dokumente für einen User bis zu einem bestimmten Datum existieren
 * @param {string} userId - User ID
 * @param {string} targetDate - Ziel-Datum im Format YYYY-MM-DD
 * @param {object} ctx - Azure Functions Context für Logging
 */
export async function ensureDaysUpTo(userId, targetDate, ctx) {
  const { timeline } = cosmos();
  
  // Prüfe das letzte existierende Day-Dokument für diesen User
  const query = {
    query: "SELECT c.date FROM c WHERE c.userId = @userId AND c.type = 'day' ORDER BY c.date DESC OFFSET 0 LIMIT 1",
    parameters: [{ name: "@userId", value: userId }]
  };
  
  const { resources } = await timeline.items.query(query).fetchAll();
  
  let startDate;
  if (resources.length === 0) {
    // Keine Tage vorhanden, starte mit heute
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Starte einen Tag nach dem letzten vorhandenen Tag
    startDate = new Date(resources[0].date + "T00:00:00Z");
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }
  
  const targetDateObj = new Date(targetDate + "T00:00:00Z");
  
  // Erstelle nur 7 Tage im Voraus (kein zusätzlicher Buffer mehr)
  const maxDaysAhead = 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);
  
  // Verwende das kleinere der beiden Daten (targetDate oder maxDate)
  if (targetDateObj > maxDate) {
    targetDateObj.setTime(maxDate.getTime());
  }
  
  const daysCreated = [];
  
  // Erstelle alle fehlenden Tage
  while (startDate <= targetDateObj) {
    const dateId = startDate.toISOString().slice(0, 10);
    const weekday = ((startDate.getUTCDay() + 6) % 7) + 1; // Mo=1..So=7
    
    // Prüfe, ob das der heutige Tag ist und welche Slots noch verfügbar sind
    const isToday = dateId === today.toISOString().split('T')[0];
    const now = new Date();
    const currentHour = now.getHours();
    
    // Morgens: bis 12 Uhr, Mittags: bis 17 Uhr, Abends: danach
    const morningLocked = isToday && currentHour >= 12;
    const middayLocked = isToday && currentHour >= 17;
    
    const doc = {
      id: dateId,
      type: "day",
      userId,
      date: dateId,
      weekday,
      tz: "Europe/Berlin",
      slots: [
        mkSlot(0, "AM", morningLocked, false),
        mkSlot(1, "PM", middayLocked, false),
        mkSlot(2, "EV", false, true)
      ],
      meta: { autoFillEnabled: true, notes: [] }
    };
    
    try {
      await timeline.items.create(doc, { disableAutomaticIdGeneration: true });
      daysCreated.push(dateId);
      if (ctx) ctx.log(`Created day ${dateId} for ${userId}`);
    } catch (e) {
      // 409 Conflict → existiert bereits → ignorieren
      if (e.code !== 409) {
        if (ctx) ctx.log.warn(`ensureDays: ${dateId} ${userId} -> ${e.message}`);
      }
    }
    
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }
  
  return daysCreated;
}

function mkSlot(idx, label, locked, manualOnly) {
  return {
    idx,
    label,
    startLocal: null,
    endLocal: null,
    locked,
    manualOnly,
    assignment: { taskId: null, kind: null, source: null, taskTitle: null }
  };
}
