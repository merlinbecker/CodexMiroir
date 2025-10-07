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

function htmlEscape(s) {
  return (s || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#39;"
  }[c]));
}

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
  // Match pattern: 0000-something.md or just 0000.md
  const match = filename.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : 9999;
}

// ============================================================================
// TIMELINE SKELETON
// ============================================================================

function createWeekSkeleton(startDate) {
  const skeleton = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = formatDateStr(date);

    const day = {
      datum: dateStr,
      dayOfWeek: date.getDay(),
      slots: SLOTS.map(slot => ({
        zeit: slot,
        task: null,
        isFixed: false
      }))
    };

    skeleton.push(day);
  }

  return skeleton;
}

// ============================================================================
// TASK PLACEMENT LOGIC
// ============================================================================

function placeFixedTasks(timeline, tasks) {
  const fixedTasks = tasks.filter(t => t.fixedSlot);

  fixedTasks.forEach(task => {
    const targetDateStr = task.fixedSlot.datum;
    const targetSlot = task.fixedSlot.zeit;
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
  for (let i = 0; i < AUTO_FILLABLE_SLOTS.length; i++) {
    const slotName = AUTO_FILLABLE_SLOTS[i];
    const slotIndex = SLOTS.indexOf(slotName);
    const slot = day.slots[slotIndex];

    if (!slot.task) {
      slot.task = task;
      slot.isFixed = false;
      return true;
    }

    if (!slot.isFixed) {
      const displaced = slot.task;
      slot.task = task;
      slot.isFixed = false;
      shiftTaskForward(timeline, day, slotIndex, displaced);
      return true;
    }
  }

  return false;
}

function autoFillTasks(timeline, tasks) {
  const openTasks = tasks
    .filter(t => !t.fixedSlot)
    .sort((a, b) => extractTaskNumber(a.file) - extractTaskNumber(b.file));

  openTasks.forEach(task => {
    const kategorie = task.kategorie;

    for (const day of timeline) {
      const dayDate = parseDateStr(day.datum);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dayDate < today) continue; // Keine Vergangenheit

      // Kategorie-Regeln prüfen
      if (kategorie === 'arbeit' && !isWeekday(dayDate)) continue;
      if (kategorie === 'privat' && !isWeekend(dayDate)) continue;

      if (placeTaskInDay(timeline, day, task)) {
        break; // Task platziert
      }
    }
  });
}

// ============================================================================
// CACHE & BUILD
// ============================================================================

async function getLastHeadSha() {
  const sha = await getTextBlob("state/lastHeadSha.txt");
  return sha?.trim() || "no-sha";
}

async function loadOrBuildTimeline(headSha, context, nocache = false) {
  const artifactPath = `artifacts/timeline_${headSha}.json`;

  // Cache Check
  if (!nocache) {
    const cached = await getTextBlob(artifactPath);
    if (cached) {
      context.log(`[renderCodex] Cache HIT for ${headSha}`);
      return { json: JSON.parse(cached), etag: headSha };
    }
  } else {
    context.log(`[renderCodex] Cache BYPASS requested`);
  }

  // Build Timeline
  const files = await list("raw/tasks/");
  const tasks = [];

  context.log(`[renderCodex] Found ${files.length} files in raw/tasks/`);

  for (const name of files) {
    if (!name.endsWith(".md")) continue;
    const md = await getTextBlob(name);
    if (!md) {
      context.log(`[renderCodex] Empty file: ${name}`);
      continue;
    }
    const t = parseTask(md);
    context.log(`[renderCodex] Parsed ${name}:`, JSON.stringify(t));

    if (t.typ !== "task" || t.status !== "offen") {
      context.log(`[renderCodex] Skipped ${name}: typ=${t.typ}, status=${t.status}`);
      continue;
    }
    
    // Skip completed tasks
    if (t.status === "abgeschlossen") {
      context.log(`[renderCodex] Skipped completed task ${name}`);
      continue;
    }
    tasks.push({ file: name, ...t });
  }

  context.log(`[renderCodex] Total valid tasks: ${tasks.length}`);

  // Erstelle Timeline-Skeleton für 7 Tage ab heute
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalisiere auf Tagesbeginn
  const weekStart = new Date(now); // Speichere Start für Meta-Info

  // Beginne mit heute und zeige 7 Tage voraus
  const timeline = createWeekSkeleton(weekStart);

  // Platziere Tasks
  context.log(`[renderCodex] Placing ${tasks.length} tasks in timeline`);
  placeFixedTasks(timeline, tasks);
  autoFillTasks(timeline, tasks);

  // Count placed tasks
  const placedCount = timeline.reduce((sum, day) => 
    sum + day.slots.filter(s => s.task).length, 0);
  context.log(`[renderCodex] Placed ${placedCount} tasks in timeline`);

  // Payload erstellen
  const payload = {
    headSha,
    generatedAt: new Date().toISOString(),
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

  return { json: payload, etag: headSha };
}

// ============================================================================
// HTML RENDERING
// ============================================================================

function buildHtmlFromTimeline(data) {
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const timeline = data.timeline || [];

  let html = `<!doctype html><meta charset="utf-8"><title>Codex Miroir Timeline</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial,sans-serif;margin:20px;background:#fafafa}
h1{font-size:22px;margin:0 0 8px;color:#333}
.meta{color:#666;font-size:13px;margin-bottom:20px}
.timeline{display:flex;flex-direction:column;gap:16px;margin-top:16px;max-width:900px}
.day{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px}
.day-header{font-weight:600;font-size:14px;margin-bottom:10px;color:#444}
.slot{margin:8px 0;padding:8px;border-left:3px solid #ddd;background:#f9f9f9}
.slot.morgens{border-left-color:#4CAF50}
.slot.nachmittags{border-left-color:#2196F3}
.slot.abends{border-left-color:#FF9800}
.slot-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;margin-bottom:4px}
.task-title{font-size:13px;color:#222}
.badge{display:inline-block;font-size:11px;padding:2px 6px;border-radius:4px;background:#e0e0e0;margin-left:4px}
.badge.fixed{background:#ff5722;color:#fff}
.tag{font-size:11px;color:#666;margin-left:4px}
.empty{color:#aaa;font-size:12px}
</style>
<h1>Codex Miroir – Wochenansicht</h1>
<div class="meta">Woche ab ${htmlEscape(data.weekStart)} | Stand: ${htmlEscape(data.generatedAt)}</div>
<div class="timeline">`;

  for (const day of timeline) {
    const dayName = dayNames[day.dayOfWeek];
    html += `<div class="day">
      <div class="day-header">${htmlEscape(dayName)} ${htmlEscape(day.datum)}</div>`;

    for (const slot of day.slots) {
      html += `<div class="slot ${htmlEscape(slot.zeit)}">
        <div class="slot-label">${htmlEscape(slot.zeit)}</div>`;

      if (slot.task) {
        const title = slot.task.file.split('/').pop().replace(/^\d{4}\.md$/, '').replace(/-/g, ' ');
        const num = extractTaskNumber(slot.task.file);

        html += `<div class="task-title">[${num}] ${htmlEscape(title)}
          <span class="badge">${htmlEscape(slot.task.kategorie || '?')}</span>`;

        if (slot.task.isFixed) {
          html += `<span class="badge fixed">FIX</span>`;
        }

        if (slot.task.deadline) {
          html += `<span class="badge">DL: ${htmlEscape(slot.task.deadline)}</span>`;
        }

        (slot.task.tags || []).forEach(t => {
          html += `<span class="tag">#${htmlEscape(t)}</span>`;
        });

        html += `</div>`;
      } else {
        html += `<div class="empty">– leer –</div>`;
      }

      html += `</div>`;
    }

    html += `</div>`; // close .day
  }

  html += `</div>`; // close .timeline
  return html;
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
    const format = (url.searchParams.get('format') || process.env.RENDER_DEFAULT_FORMAT || "json").toLowerCase();
    const nocache = url.searchParams.get('nocache') === 'true';
    context.log('[renderCodex] Format:', format, 'NoCache:', nocache);

    const headSha = await getLastHeadSha();
    context.log('[renderCodex] HeadSha:', headSha);

    // HTTP Caching: ETag Check
    const ifNoneMatch = request.headers.get("if-none-match");
    if (!nocache && ifNoneMatch && ifNoneMatch.replace(/"/g, "") === headSha) {
      return {
        status: 304,
        headers: { "ETag": `"${headSha}"` }
      };
    }

    // Lade oder baue Timeline
    context.log('[renderCodex] Loading timeline...');
    const { json, etag } = await loadOrBuildTimeline(headSha, context, nocache);
    context.log('[renderCodex] Timeline loaded, timeline has', json?.timeline?.length || 0, 'days');

    if (format === "html") {
      context.log('[renderCodex] Rendering HTML');
      const html = buildHtmlFromTimeline(json);
      context.log('[renderCodex] HTML length:', html.length);
      return {
        headers: { 
          "content-type": "text/html; charset=utf-8",
          "ETag": `"${etag}"`
        },
        body: html
      };
    }

    // JSON
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
