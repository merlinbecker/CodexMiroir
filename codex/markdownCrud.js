/**
 * Markdown CRUD API - Task Management Operationen
 * 
 * Diese Datei enthält alle CRUD-Operationen für Tasks im Markdown-Format:
 * - createTask: Erstellt neue Task-Datei und current.md Eintrag
 * - completeTask: Markiert Task als abgeschlossen und archiviert
 * - pushToEnd: Verschiebt Task ans Ende der Warteschlange
 * - report: Liefert Übersicht über aktuelle Tasks
 * - when: Zeigt nächsten verfügbaren Zeitslot
 */

const matter = require("gray-matter");
const {
  validateToken,
  getUserContainerPath,
  readText,
  writeText,
  ymd,
  ddmmyyyy,
  weekOf,
  getNextSlot,
  ensureTableCurrent,
  appendRow,
  removeRowByRelLink,
  extractWeek,
  replaceWeek
} = require('./helpers');

// ============================================================================
// TASK CREATION
// ============================================================================

/**
 * Erstellt neue Task-Datei mit Frontmatter und aktualisiert current.md
 * @param {Object} body - Request Body mit Task-Daten
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Erfolgs-Response mit Pfaden
 */
async function createTask(body, token) {
  const { 
    list, id, title, created_at_iso, scheduled_slot, category, 
    deadline_iso, project, azure_devops, requester, duration_slots = 1 
  } = body;
  
  // Validate required fields
  if (!list || !id || !title || !created_at_iso || !scheduled_slot) {
    throw new Error("missing required fields: list, id, title, created_at_iso, scheduled_slot");
  }

  // Validate token
  validateToken(token);

  // Generate file paths with token-based user directory
  const year = ymd(created_at_iso).slice(0, 4);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const relTask = `./tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;
  const userContainerPath = getUserContainerPath(token, list);
  const absTask = `${userContainerPath}/tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;

  // Create task file with frontmatter
  const fm = {
    id, list, title, status: "geplant",
    created_at: ddmmyyyy(created_at_iso),
    scheduled_slot, duration_slots,
    deadline: deadline_iso ? ddmmyyyy(deadline_iso) : "",
    project, azure_devops, requester,
    category_pro: list === "pro" ? category : undefined,
    category_priv: list === "priv" ? category : undefined
  };
  
  // Generate markdown content with frontmatter
  const taskMD = matter.stringify(
    `## Notiz\n\nkurz…\n\n## Verlauf\n- ${ddmmyyyy(created_at_iso)} → geplant in \`${scheduled_slot}\`\n`,
    fm
  );
  await writeText(absTask, taskMD);

  // Update current.md with new task entry
  const week = weekOf(scheduled_slot);
  const currentPath = `${userContainerPath}/current.md`;
  let current = await readText(currentPath) || `# Codex Miroir — CURRENT (${list})\n\n> Aktueller Slot: \`${scheduled_slot}\`\n`;
  let sec = extractWeek(current, week) || `## Woche ${week}\n${ensureTableCurrent("")}`;
  
  // Create table row for the new task
  const row = `| ${scheduled_slot.padEnd(19)} | [${id}: ${title}](${relTask}) | ${category || ""} | ${deadline_iso ? ddmmyyyy(deadline_iso) : ""} |`;
  sec = appendRow(sec, row);
  current = replaceWeek(current, week, sec);
  await writeText(currentPath, current);

  return { 
    ok: true, 
    message: `Task "${title}" erfolgreich erstellt`,
    taskPath: absTask, 
    currentPath 
  };
}

// ============================================================================
// TASK COMPLETION
// ============================================================================

/**
 * Markiert Task als abgeschlossen, entfernt aus current.md und archiviert
 * @param {Object} body - Request Body mit Task-Daten
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Erfolgs-Response
 */
async function completeTask(body, token) {
  const { list, taskPathAbs, closed_at_iso } = body;
  
  // Validate required fields
  if (!list || !taskPathAbs || !closed_at_iso) {
    throw new Error("missing required fields: list, taskPathAbs, closed_at_iso");
  }

  // Validate token
  validateToken(token);

  // Update task file with completion status
  const md = await readText(taskPathAbs);
  if (!md) throw new Error("task file not found");
  
  const parsed = matter(md); 
  const fm = parsed.data;
  fm.status = "abgeschlossen";
  fm.closed_at = ddmmyyyy(closed_at_iso);
  
  // Update history section in task content
  const verlauf = `## Verlauf\n- ${fm.created_at} → geplant in \`${fm.scheduled_slot}\`\n- ${ddmmyyyy(closed_at_iso)} → abgeschlossen\n`;
  const updatedMD = matter.stringify(parsed.content.replace(/## Verlauf[\s\S]*/, verlauf), fm);
  await writeText(taskPathAbs, updatedMD);

  // Remove from current.md and add to archive.md
  const userContainerPath = getUserContainerPath(token, list);
  const currentPath = `${userContainerPath}/current.md`;
  const archivePath = `${userContainerPath}/archive.md`;
  
  // Remove from current tasks
  let current = await readText(currentPath) || "";
  const week = weekOf(fm.scheduled_slot);
  let sec = extractWeek(current, week);
  
  if (sec) {
    const relPath = taskPathAbs.replace(`${userContainerPath}/`, "./");
    sec = removeRowByRelLink(sec, relPath);
    current = replaceWeek(current, week, sec);
    await writeText(currentPath, current);
  }

  // Add to archive
  let archive = await readText(archivePath) || `# Codex Miroir — ARCHIVE (${list})\n\n`;
  let archiveSec = extractWeek(archive, week) || `## Woche ${week}\n${ensureTableCurrent("")}`;
  
  const relTask = taskPathAbs.replace(`${userContainerPath}/`, "./");
  const row = `| ${fm.scheduled_slot.padEnd(19)} | [${fm.id}: ${fm.title}](${relTask}) | ${fm.category_pro || fm.category_priv || ""} | ${fm.deadline || ""} |`;
  archiveSec = appendRow(archiveSec, row);
  archive = replaceWeek(archive, week, archiveSec);
  await writeText(archivePath, archive);

  return { 
    ok: true, 
    message: `Task "${fm.title}" erfolgreich abgeschlossen und archiviert`
  };
}

// ============================================================================
// TASK RESCHEDULING
// ============================================================================

/**
 * Verschiebt Task ans Ende der Warteschlange (neuer Zeitslot)
 * @param {Object} body - Request Body mit Task-Daten
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Erfolgs-Response
 */
async function pushToEnd(body, token) {
  const { list, taskPathAbs, new_scheduled_slot } = body;
  
  // Validate required fields
  if (!list || !taskPathAbs || !new_scheduled_slot) {
    throw new Error("missing required fields: list, taskPathAbs, new_scheduled_slot");
  }

  // Validate token
  validateToken(token);

  // Update task file with new schedule
  const md = await readText(taskPathAbs);
  if (!md) throw new Error("task file not found");
  
  const parsed = matter(md);
  const fm = parsed.data;
  const oldSlot = fm.scheduled_slot;
  fm.scheduled_slot = new_scheduled_slot;
  
  // Update history in task content
  const verlauf = parsed.content.replace(/## Verlauf[\s\S]*/, 
    `## Verlauf\n- ${fm.created_at} → geplant in \`${oldSlot}\`\n- ${ddmmyyyy(new Date().toISOString())} → verschoben nach \`${new_scheduled_slot}\`\n`
  );
  const updatedMD = matter.stringify(verlauf, fm);
  await writeText(taskPathAbs, updatedMD);

  // Update current.md - remove from old week, add to new week
  const userContainerPath = getUserContainerPath(token, list);
  const currentPath = `${userContainerPath}/current.md`;
  let current = await readText(currentPath) || `# Codex Miroir — CURRENT (${list})\n\n`;
  
  // Remove from old week
  const oldWeek = weekOf(oldSlot);
  let oldSec = extractWeek(current, oldWeek);
  if (oldSec) {
    const relPath = taskPathAbs.replace(`${userContainerPath}/`, "./");
    oldSec = removeRowByRelLink(oldSec, relPath);
    current = replaceWeek(current, oldWeek, oldSec);
  }
  
  // Add to new week
  const newWeek = weekOf(new_scheduled_slot);
  let newSec = extractWeek(current, newWeek) || `## Woche ${newWeek}\n${ensureTableCurrent("")}`;
  
  const relTask = taskPathAbs.replace(`${userContainerPath}/`, "./");
  const row = `| ${new_scheduled_slot.padEnd(19)} | [${fm.id}: ${fm.title}](${relTask}) | ${fm.category_pro || fm.category_priv || ""} | ${fm.deadline || ""} |`;
  newSec = appendRow(newSec, row);
  current = replaceWeek(current, newWeek, newSec);
  await writeText(currentPath, current);

  return { 
    ok: true,
    message: `Task "${fm.title}" von ${oldSlot} nach ${new_scheduled_slot} verschoben`
  };
}

// ============================================================================
// REPORTING & QUERIES
// ============================================================================

/**
 * Liefert Übersicht über aktuelle Tasks einer Liste
 * @param {Object} body - Request Body mit list Parameter
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Task-Report mit Statistiken
 */
async function report(body, token) {
  const { list } = body;
  if (!list) throw new Error("missing required parameter: list");

  // Validate token
  validateToken(token);

  const userContainerPath = getUserContainerPath(token, list);
  const currentPath = `${userContainerPath}/current.md`;
  const current = await readText(currentPath);
  
  if (!current) {
    return { 
      tasks: [], 
      total: 0,
      message: `Keine Tasks gefunden für ${list === 'pro' ? 'berufliche' : 'private'} Liste`
    };
  }

  // Parse current tasks from markdown tables
  const tasks = [];
  const lines = current.split('\n');
  
  for (const line of lines) {
    // Match table rows with task links
    if (line.includes('|') && line.includes('[') && line.includes('](')) {
      const match = line.match(/\|\s*([^|]+)\s*\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/);
      if (match) {
        tasks.push({
          slot: match[1].trim(),
          task: match[2].trim(),
          category: match[3].trim(),
          deadline: match[4].trim()
        });
      }
    }
  }

  // Generate statistics by category
  const categoryStats = {};
  tasks.forEach(task => {
    if (task.category) {
      categoryStats[task.category] = (categoryStats[task.category] || 0) + 1;
    }
  });

  return { 
    tasks, 
    total: tasks.length,
    categoryStats,
    message: `${tasks.length} aktive Tasks gefunden`
  };
}

/**
 * Zeigt nächsten verfügbaren Zeitslot für neue Tasks
 * @param {Object} body - Request Body mit list Parameter
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Nächster verfügbarer Slot
 */
async function when(body, token) {
  const { list } = body;
  if (!list) throw new Error("missing required parameter: list");

  // Validate token
  validateToken(token);

  // Get next available slot based on list type and current time
  const nextSlot = getNextSlot(list);
  
  return { 
    nextSlot, 
    listType: list,
    message: `Nächster verfügbarer ${list === 'pro' ? 'beruflicher' : 'privater'} Slot: ${nextSlot}`
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createTask,
  completeTask,
  pushToEnd,
  report,
  when
};