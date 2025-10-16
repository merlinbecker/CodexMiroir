import { app } from '@azure/functions';
import { list, list as listBlobs, getTextBlob, putTextBlob } from "../shared/storage.js";
import { parseTask } from "../shared/parsing.js";
import { validateAuth } from "../shared/auth.js";

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
  for (let i = 0; i < day.slots.length; i++) {
    const slot = day.slots[i];
    const slotName = slot.zeit;

    // Nur auto-fillable Slots verwenden (nicht 'abends')
    if (!AUTO_FILLABLE_SLOTS.includes(slotName)) {
      continue;
    }

    if (!slot.task) {
      slot.task = task;
      slot.isFixed = false;
      return true;
    }

    if (!slot.isFixed) {
      const displaced = slot.task;
      slot.task = task;
      slot.isFixed = false;
      shiftTaskForward(timeline, day, i, displaced);
      return true;
    }
  }

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

  const unplacedTasks = [];

  sortedTasks.forEach((task) => {
    const kategorie = task.kategorie;
    let placed = false;

    for (const day of timeline) {
      const dayDate = parseDateStr(day.datum);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dayDate < today) {
        continue;
      }

      // Kategorie-Regeln prüfen
      if (kategorie === 'arbeit' && !isWeekday(dayDate)) {
        continue;
      }
      if (kategorie === 'privat' && !isWeekend(dayDate)) {
        continue;
      }
      
      // WICHTIG: Nur leere Slots verwenden, KEINE Verdrängung mehr
      // Dadurch bleibt die aufsteigende Reihenfolge erhalten
      const emptySlot = day.slots.find(s => 
        !s.task && AUTO_FILLABLE_SLOTS.includes(s.zeit)
      );
      
      if (emptySlot) {
        emptySlot.task = task;
        emptySlot.isFixed = false;
        placed = true;
        break;
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

const CACHE_TTL_BLOB = 15 * 60 * 1000;  // 15 Minuten
const CACHE_TTL_LOCAL = 5 * 60 * 1000;  // 5 Minuten
const localCache = new Map(); // In-Memory Cache pro Function-Instance

async function getCachedTimeline(userId, context) {
  // Layer 1: Local Memory (1-5ms, flüchtig)
  const local = localCache.get(userId);
  if (local && local.validUntil > Date.now()) {
    context.log(`[renderCodex] Local cache HIT for ${userId} (valid for ${Math.floor((local.validUntil - Date.now()) / 1000)}s)`);
    return local.timeline;
  }
  
  // Layer 2: Blob Storage (100ms, persistent)
  const blobPath = `artifacts/${userId}/timeline.json`;
  const cached = await getTextBlob(blobPath);
  
  if (cached) {
    const data = JSON.parse(cached);
    const age = Date.now() - new Date(data.cacheCreatedAt).getTime();
    
    if (age < CACHE_TTL_BLOB) {
      context.log(`[renderCodex] Blob cache HIT for ${userId} (age: ${Math.floor(age / 1000)}s / ${Math.floor(CACHE_TTL_BLOB / 1000)}s)`);
      
      // Cache lokal für schnellere Wiederverwendung
      localCache.set(userId, {
        timeline: data,
        validUntil: Date.now() + CACHE_TTL_LOCAL
      });
      
      return data;
    } else {
      context.log(`[renderCodex] Blob cache EXPIRED for ${userId} (age: ${Math.floor(age / 1000)}s > TTL: ${Math.floor(CACHE_TTL_BLOB / 1000)}s)`);
    }
  }
  
  // Layer 3: Cache MISS - Rebuild notwendig
  context.log(`[renderCodex] Cache MISS for ${userId} - rebuild required`);
  return null;
}

async function loadOrBuildTimeline(context, userId, nocache = false) {
  // Cache Check (sofern nicht bypassed)
  if (!nocache) {
    const cached = await getCachedTimeline(userId, context);
    if (cached) {
      return { json: cached, fromCache: true };
    }
  } else {
    context.log(`[renderCodex] Cache BYPASS requested for ${userId}`);
  }

  // Build Timeline from Storage (Layer 3: Rebuild)
  context.log(`[renderCodex] Building timeline for ${userId} from storage...`);
  context.log(`[renderCodex] Listing files from: raw/${userId}/tasks/`);
  const files = await list(`raw/${userId}/tasks/`);
  const tasks = [];

  context.log(`[renderCodex] Found ${files.length} files in raw/${userId}/tasks/`);

  for (const name of files) {
    if (!name.endsWith(".md")) {
      continue;
    }
    
    const md = await getTextBlob(name);
    
    if (!md) {
      context.log(`[renderCodex] WARNING: Empty or missing content for file: ${name}`);
      continue;
    }
    
    const t = parseTask(md);

    if (t.typ !== "task") {
      continue;
    }
    
    if (t.status === "abgeschlossen") {
      continue;
    }
    
    if (t.status !== "offen") {
      continue;
    }
    
    tasks.push({ file: name, ...t });
  }

  context.log(`[renderCodex] Total valid tasks: ${tasks.length}`);

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
  
  context.log(`[renderCodex] Fixed tasks: ${fixedTasks.length}, Open tasks: ${openTasks.length}`);
  
  // Platziere Fixed Tasks zuerst
  placeFixedTasks(timeline, fixedTasks);
  
  // Platziere Open Tasks (aufsteigend nach ID sortiert)
  autoFillTasks(timeline, openTasks);

  // Count placed tasks
  const placedCount = timeline.reduce((sum, day) => 
    sum + day.slots.filter(s => s.task).length, 0);
  
  context.log(`[renderCodex] Placement summary: ${placedCount}/${tasks.length} tasks placed`);

  // Nächste verfügbare ID laden
  const nextIdText = await getTextBlob(`state/${userId}/nextId.txt`);
  const nextId = nextIdText ? parseInt(nextIdText.trim(), 10) : 0;
  const nextIdFormatted = String(nextId).padStart(4, '0');
  
  // Payload erstellen - Timeline enthält bereits nur zukünftige Slots
  const payload = {
    cacheCreatedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    nextAvailableId: nextIdFormatted,
    weekStart: formatDateStr(weekStart),
    userId,
    timeline: timeline.map(day => ({
      datum: day.datum,
      dayOfWeek: day.dayOfWeek,
      slots: day.slots.map(slot => ({
        zeit: slot.zeit,
        task: slot.task ? {
          file: slot.task.file,
          kategorie: slot.task.kategorie,
          status: slot.task.status,
          tags: slot.task.tags || [],
          isFixed: slot.isFixed
        } : null
      }))
    }))
  };

  // Cache speichern (Blob + Local)
  const blobPath = `artifacts/${userId}/timeline.json`;
  await putTextBlob(blobPath, JSON.stringify(payload), "application/json");
  context.log(`[renderCodex] Timeline cached to: ${blobPath}`);
  
  // Local Memory Cache
  localCache.set(userId, {
    timeline: payload,
    validUntil: Date.now() + CACHE_TTL_LOCAL
  });

  return { json: payload, fromCache: false };
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

app.http('renderCodex', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'codex',
  handler: async (request, context) => {
    context.log('[renderCodex] Request received');
    
    try {
      // Validate OAuth2 token and extract userId
      const { userId, error } = await validateAuth(request);
      if (error) {
        return error;
      }
      
      const url = new URL(request.url);
      context.log('[renderCodex] URL:', url.toString());
      const nocache = url.searchParams.get('nocache') === 'true';
      context.log('[renderCodex] NoCache:', nocache);
      context.log('[renderCodex] UserId:', userId);

      // Lade oder baue Timeline
      context.log('[renderCodex] Loading timeline...');
      const { json, fromCache } = await loadOrBuildTimeline(context, userId, nocache);
      context.log(`[renderCodex] Timeline loaded (fromCache: ${fromCache}), timeline has ${json?.timeline?.length || 0} days`);

      // Return JSON
      context.log('[renderCodex] Returning JSON');
      return {
        headers: { 
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-cache" // Client soll nicht cachen, Server managed Cache
        },
        jsonBody: json
      };
    } catch (error) {
      context.log('[renderCodex] Error:', error);
      return {
        status: 500,
        jsonBody: {
          ok: false,
          error: error.message
        }
      };
    }
  }
});
