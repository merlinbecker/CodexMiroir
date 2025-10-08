import { app } from '@azure/functions';
import { list, getTextBlob, putTextBlob } from "../shared/storage.js";
import { parseTask } from "../shared/parsing.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const SLOTS = ['morgens', 'nachmittags', 'abends'];
const AUTO_FILLABLE_SLOTS = ['morgens', 'nachmittags'];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Mo-Fr
const WEEKENDS = [0, 6]; // Sa-So

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDateStr(dateStr) {
  // dd.mm.yyyy -> Date object
  const [dd, mm, yyyy] = dateStr.split('.');
  return new Date(yyyy, mm - 1, dd);
}

function formatDateStr(date) {
  // Date -> dd.mm.yyyy
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mo als Start
  return new Date(d.setDate(diff));
}

function isWeekday(date) {
  return WEEKDAYS.includes(date.getDay());
}

function isWeekend(date) {
  return WEEKENDS.includes(date.getDay());
}

function extractTaskNumber(filename) {
  // Match pattern: 0000-Titel.md or just 0000.md
  const match = filename.match(/(\d{4})(-[^/]+)?\.md$/);
  return match ? parseInt(match[1], 10) : 9999;
}

// ============================================================================
// TIMELINE SKELETON
// ============================================================================

function createWeekSkeleton(startDate, currentHour) {
  const skeleton = [];
  const today = new Date(startDate);
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = formatDateStr(date);
    const isToday = i === 0;

    // Bestimme welche Slots für diesen Tag verfügbar sind
    let availableSlots = SLOTS;
    
    if (isToday) {
      // Heute: Nur zukünftige Slots
      if (currentHour >= 19) {
        availableSlots = []; // Kein Slot mehr heute verfügbar
      } else if (currentHour >= 14) {
        availableSlots = ['abends']; // Nur Abends verfügbar
      } else if (currentHour >= 9) {
        availableSlots = ['nachmittags', 'abends']; // Nachmittags und Abends
      }
      // Sonst: currentHour < 9, alle Slots verfügbar
    }

    // Nur Tage mit verfügbaren Slots hinzufügen
    if (availableSlots.length > 0) {
      const day = {
        datum: dateStr,
        dayOfWeek: date.getDay(),
        slots: availableSlots.map(slot => ({
          zeit: slot,
          task: null,
          isFixed: false
        }))
      };

      skeleton.push(day);
    }
  }

  return skeleton;
}

// ============================================================================
// TASK PLACEMENT LOGIC
// ============================================================================

function placeFixedTasks(timeline, tasks) {
  tasks.forEach(task => {
    // Normalisiere fixedSlot zu Objekt-Format
    let datum, zeit;
    
    if (Array.isArray(task.fixedSlot)) {
      const datumObj = task.fixedSlot.find(obj => obj.datum !== undefined);
      const zeitObj = task.fixedSlot.find(obj => obj.zeit !== undefined);
      datum = datumObj?.datum;
      zeit = zeitObj?.zeit;
    } else {
      datum = task.fixedSlot.datum;
      zeit = task.fixedSlot.zeit;
    }
    
    const targetDateStr = datum;
    const targetSlot = zeit;
    const targetDay = timeline.find(d => d.datum === targetDateStr);

    if (!targetDay) return; // Datum außerhalb der Timeline

    const slotIndex = SLOTS.indexOf(targetSlot);
    if (slotIndex === -1) return; // Ungültiger Slot

    const slot = targetDay.slots[slotIndex];

    if (slot.task && !slot.isFixed) {
      // Domino: Verschiebe nicht-fixen Task
      shiftTaskForward(timeline, targetDay, slotIndex, slot.task);
    }

    // Platziere fixed Task
    slot.task = task;
    slot.isFixed = true;
  });
}

function shiftTaskForward(timeline, currentDay, fromSlotIndex, task) {
  // Versuche nächsten Slot im selben Tag
  for (let i = fromSlotIndex + 1; i < SLOTS.length; i++) {
    const slot = currentDay.slots[i];

    if (!slot.task) {
      slot.task = task;
      slot.isFixed = false;
      return;
    }

    if (!slot.isFixed) {
      // Rekursiv weiterschieben
      const nextTask = slot.task;
      slot.task = task;
      slot.isFixed = false;
      shiftTaskForward(timeline, currentDay, i, nextTask);
      return;
    }
  }

  // Überlauf: Nächster passender Tag
  const nextDay = findNextSuitableDay(timeline, currentDay.datum, task.kategorie);
  if (nextDay) {
    placeTaskInDay(timeline, nextDay, task);
  }
}

function findNextSuitableDay(timeline, fromDateStr, kategorie) {
  const fromDate = parseDateStr(fromDateStr);

  for (const day of timeline) {
    const dayDate = parseDateStr(day.datum);
    if (dayDate <= fromDate) continue;

    if (kategorie === 'arbeit' && isWeekday(dayDate)) return day;
    if (kategorie === 'privat' && isWeekend(dayDate)) return day;
  }

  return null;
}

function placeTaskInDay(timeline, day, task) {
  console.log(`[placeTaskInDay] Attempting to place ${task.file} in ${day.datum}`);
  
  for (let i = 0; i < day.slots.length; i++) {
    const slot = day.slots[i];
    const slotName = slot.zeit;

    // Nur auto-fillable Slots verwenden (nicht 'abends')
    if (!AUTO_FILLABLE_SLOTS.includes(slotName)) {
      continue;
    }

    console.log(`[placeTaskInDay]   Checking slot ${slotName}: has_task=${!!slot.task}, isFixed=${slot.isFixed}`);

    if (!slot.task) {
      console.log(`[placeTaskInDay]   ✅ Empty slot found at ${slotName}, placing task`);
      slot.task = task;
      slot.isFixed = false;
      return true;
    }

    if (!slot.isFixed) {
      console.log(`[placeTaskInDay]   ↻ Non-fixed task in ${slotName}, displacing it`);
      const displaced = slot.task;
      slot.task = task;
      slot.isFixed = false;
      shiftTaskForward(timeline, day, i, displaced);
      return true;
    }
    
    console.log(`[placeTaskInDay]   ❌ Slot ${slotName} occupied by fixed task`);
  }

  console.log(`[placeTaskInDay]   ❌ No available slots in ${day.datum}`);
  return false;
}

function autoFillTasks(timeline, tasks) {
  // Sortiere ALLE übergebenen Tasks nach ID AUFSTEIGEND (kleinere ID zuerst!)
  const sortedTasks = tasks
    .slice() // Kopie erstellen für saubere Sortierung
    .sort((a, b) => {
      const idA = extractTaskNumber(a.file);
      const idB = extractTaskNumber(b.file);
      return idA - idB; // Aufsteigend: 0002 vor 0003 vor 0104
    });

  console.log(`[autoFillTasks] Sorted task IDs (ascending):`, sortedTasks.map(t => extractTaskNumber(t.file)));

  const unplacedTasks = [];

  console.log(`[autoFillTasks] Processing ${sortedTasks.length} open tasks in ASCENDING order`);

  sortedTasks.forEach((task, idx) => {
    const kategorie = task.kategorie;
    let placed = false;

    console.log(`[autoFillTasks] Task ${idx + 1}/${sortedTasks.length}: ${task.file} (ID=${extractTaskNumber(task.file)}, kategorie=${kategorie})`);

    for (const day of timeline) {
      const dayDate = parseDateStr(day.datum);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dayDate < today) {
        console.log(`[autoFillTasks]   ❌ Skip day ${day.datum}: in the past`);
        continue;
      }

      // Kategorie-Regeln prüfen
      if (kategorie === 'arbeit' && !isWeekday(dayDate)) {
        console.log(`[autoFillTasks]   ❌ Skip day ${day.datum}: arbeit task needs weekday`);
        continue;
      }
      if (kategorie === 'privat' && !isWeekend(dayDate)) {
        console.log(`[autoFillTasks]   ❌ Skip day ${day.datum}: privat task needs weekend`);
        continue;
      }

      console.log(`[autoFillTasks]   ✓ Trying to place in day ${day.datum}`);
      
      // WICHTIG: Nur leere Slots verwenden, KEINE Verdrängung mehr
      // Dadurch bleibt die aufsteigende Reihenfolge erhalten
      const emptySlot = day.slots.find(s => 
        !s.task && AUTO_FILLABLE_SLOTS.includes(s.zeit)
      );
      
      if (emptySlot) {
        emptySlot.task = task;
        emptySlot.isFixed = false;
        console.log(`[autoFillTasks]   ✅ Placed ${task.file} (ID=${extractTaskNumber(task.file)}) in ${day.datum} ${emptySlot.zeit}`);
        placed = true;
        break;
      } else {
        console.log(`[autoFillTasks]   ❌ No free slots in ${day.datum}`);
      }
    }

    if (!placed) {
      console.warn(`[autoFillTasks] ⚠️ Task ${task.file} (ID=${extractTaskNumber(task.file)}) could not be placed anywhere`);
      unplacedTasks.push(task.file);
    }
  });

  if (unplacedTasks.length > 0) {
    console.warn(`[renderCodex] ⚠️ ${unplacedTasks.length} tasks could not be placed: ${unplacedTasks.join(', ')}`);
  }
}

// ============================================================================
// CACHE & BUILD
// ============================================================================

async function getCacheVersion() {
  const version = await getTextBlob("state/cacheVersion.txt");
  return version?.trim() || Date.now().toString();
}

async function loadOrBuildTimeline(cacheVersion, context, nocache = false) {
  const artifactPath = `artifacts/timeline_${cacheVersion}.json`;

  // Cache Check
  if (!nocache) {
    const cached = await getTextBlob(artifactPath);
    if (cached) {
      context.log(`[renderCodex] Cache HIT for version ${cacheVersion}`);
      return { json: JSON.parse(cached), etag: cacheVersion };
    }
  } else {
    context.log(`[renderCodex] Cache BYPASS requested`);
  }

  // Build Timeline
  context.log(`[renderCodex] Listing files from: raw/tasks/`);
  const files = await list("raw/tasks/");
  const tasks = [];

  context.log(`[renderCodex] Found ${files.length} files in raw/tasks/`);
  context.log(`[renderCodex] File list:`, JSON.stringify(files));

  for (const name of files) {
    context.log(`[renderCodex] Processing file: ${name}`);
    
    if (!name.endsWith(".md")) {
      context.log(`[renderCodex] Skipped non-md file: ${name}`);
      continue;
    }
    
    context.log(`[renderCodex] Reading content of: ${name}`);
    const md = await getTextBlob(name);
    
    if (!md) {
      context.log(`[renderCodex] WARNING: Empty or missing content for file: ${name}`);
      continue;
    }
    
    context.log(`[renderCodex] File content length: ${md.length} characters`);
    context.log(`[renderCodex] File content preview:`, md.substring(0, 200));
    
    const t = parseTask(md);
    context.log(`[renderCodex] Parsed task from ${name}:`, JSON.stringify(t, null, 2));

    if (t.typ !== "task") {
      context.log(`[renderCodex] ❌ Skipped ${name}: typ='${t.typ}' (expected 'task')`);
      continue;
    }
    
    if (t.status === "abgeschlossen") {
      context.log(`[renderCodex] ❌ Skipped ${name}: status='abgeschlossen'`);
      continue;
    }
    
    if (t.status !== "offen") {
      context.log(`[renderCodex] ❌ Skipped ${name}: status='${t.status}' (expected 'offen')`);
      continue;
    }
    
    context.log(`[renderCodex] ✅ Adding valid task from ${name}`);
    tasks.push({ file: name, ...t });
  }

  context.log(`[renderCodex] ========================================`);
  context.log(`[renderCodex] Total valid tasks: ${tasks.length}`);
  context.log(`[renderCodex] Task details:`, JSON.stringify(tasks, null, 2));
  context.log(`[renderCodex] ========================================`);

  // Erstelle Timeline-Skeleton für 7 Tage ab heute (nur zukünftige Slots)
  const now = new Date();
  const currentHour = now.getHours();
  now.setHours(0, 0, 0, 0); // Normalisiere auf Tagesbeginn
  const weekStart = new Date(now); // Speichere Start für Meta-Info

  // Beginne mit heute und zeige nur zukünftige Slots
  const timeline = createWeekSkeleton(weekStart, currentHour);

  // Platziere Tasks
  context.log(`[renderCodex] ========================================`);
  context.log(`[renderCodex] Starting task placement for ${tasks.length} tasks`);
  context.log(`[renderCodex] ========================================`);
  
  // Separiere Fixed vs Open Tasks
  // Fixed = hat fixedSlot UND gültiges Datum (nicht null, nicht undefined)
  const fixedTasks = tasks.filter(t => {
    if (!t.fixedSlot) return false;
    
    // Array-Format: [{ datum: "..." }, { zeit: "..." }]
    if (Array.isArray(t.fixedSlot)) {
      const datumObj = t.fixedSlot.find(obj => obj.datum !== undefined);
      return datumObj && datumObj.datum && datumObj.datum !== null;
    }
    
    // Objekt-Format: { datum: "...", zeit: "..." }
    return t.fixedSlot.datum && t.fixedSlot.datum !== null;
  });
  
  // Open = alle anderen (kein fixedSlot ODER fixedSlot ohne gültiges Datum)
  const openTasks = tasks.filter(t => {
    if (!t.fixedSlot) return true;
    
    // Array-Format
    if (Array.isArray(t.fixedSlot)) {
      const datumObj = t.fixedSlot.find(obj => obj.datum !== undefined);
      return !datumObj || !datumObj.datum || datumObj.datum === null;
    }
    
    // Objekt-Format
    return !t.fixedSlot.datum || t.fixedSlot.datum === null;
  });
  
  context.log(`[renderCodex] Fixed tasks (valid date): ${fixedTasks.length}`, JSON.stringify(fixedTasks.map(t => ({file: t.file, fixedSlot: t.fixedSlot})), null, 2));
  context.log(`[renderCodex] Open tasks (no fixed slot or invalid date): ${openTasks.length}`, JSON.stringify(openTasks.map(t => ({file: t.file, kategorie: t.kategorie})), null, 2));
  
  // Platziere Fixed Tasks zuerst
  placeFixedTasks(timeline, fixedTasks);
  context.log(`[renderCodex] Fixed tasks placed`);
  
  // Platziere Open Tasks (aufsteigend nach ID sortiert)
  autoFillTasks(timeline, openTasks);
  context.log(`[renderCodex] Auto-fill completed`);

  // Count placed tasks
  const placedCount = timeline.reduce((sum, day) => 
    sum + day.slots.filter(s => s.task).length, 0);
  
  context.log(`[renderCodex] ========================================`);
  context.log(`[renderCodex] Placement summary:`);
  context.log(`[renderCodex] - Total tasks: ${tasks.length}`);
  context.log(`[renderCodex] - Placed tasks: ${placedCount}`);
  context.log(`[renderCodex] - Unplaced tasks: ${tasks.length - placedCount}`);
  context.log(`[renderCodex] ========================================`);
  
  // Log timeline state
  timeline.forEach((day, dayIdx) => {
    const dayTasks = day.slots.filter(s => s.task).length;
    if (dayTasks > 0) {
      context.log(`[renderCodex] Day ${dayIdx} (${day.datum}): ${dayTasks} tasks`);
      day.slots.forEach(slot => {
        if (slot.task) {
          context.log(`[renderCodex]   - ${slot.zeit}: ${slot.task.file} (${slot.task.kategorie}, fixed=${slot.isFixed})`);
        }
      });
    }
  });

  // Nächste verfügbare ID laden
  const nextIdText = await getTextBlob("state/nextId.txt");
  const nextId = nextIdText ? parseInt(nextIdText.trim(), 10) : 0;
  const nextIdFormatted = String(nextId).padStart(4, '0');
  
  // Payload erstellen - Timeline enthält bereits nur zukünftige Slots
  const payload = {
    cacheVersion,
    generatedAt: new Date().toISOString(),
    cacheCreatedAt: new Date().toISOString(),
    nextAvailableId: nextIdFormatted,
    weekStart: formatDateStr(weekStart),
    timeline: timeline.map(day => ({
      datum: day.datum,
      dayOfWeek: day.dayOfWeek,
      slots: day.slots.map(slot => ({
        zeit: slot.zeit,
        task: slot.task ? {
          file: slot.task.file,
          kategorie: slot.task.kategorie,
          status: slot.task.status,
          deadline: slot.task.deadline || null,
          tags: slot.task.tags || [],
          isFixed: slot.isFixed
        } : null
      }))
    }))
  };

  // Cache speichern
  await putTextBlob(artifactPath, JSON.stringify(payload), "application/json");

  return { json: payload, etag: cacheVersion };
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

app.http('renderCodex', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'codex',
  handler: async (request, context) => {
    context.log('[renderCodex] Request received');
    const url = new URL(request.url);
    context.log('[renderCodex] URL:', url.toString());
    const nocache = url.searchParams.get('nocache') === 'true';
    context.log('[renderCodex] NoCache:', nocache);

    const cacheVersion = await getCacheVersion();
    context.log('[renderCodex] Cache Version:', cacheVersion);

    // HTTP Caching: ETag Check
    const ifNoneMatch = request.headers.get("if-none-match");
    if (!nocache && ifNoneMatch && ifNoneMatch.replace(/"/g, "") === cacheVersion) {
      return {
        status: 304,
        headers: { "ETag": `"${cacheVersion}"` }
      };
    }

    // Lade oder baue Timeline
    context.log('[renderCodex] Loading timeline...');
    const { json, etag } = await loadOrBuildTimeline(cacheVersion, context, nocache);
    context.log('[renderCodex] Timeline loaded, timeline has', json?.timeline?.length || 0, 'days');

    // Return JSON
    context.log('[renderCodex] Returning JSON');
    return {
      headers: { 
        "content-type": "application/json; charset=utf-8",
        "ETag": `"${etag}"`
      },
      jsonBody: json
    };
  }
});
