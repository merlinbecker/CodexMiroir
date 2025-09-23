const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");

// Environment & Authentication
const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";
const API_KEY = process.env.API_KEY;

// Storage helpers
let blobClient = null;

function getBlobClient() {
  if (!blobClient) {
    if (!CONN) throw new Error("AZURE_BLOB_CONN not set");
    const serviceClient = BlobServiceClient.fromConnectionString(CONN);
    blobClient = serviceClient.getContainerClient(CONTAINER);
  }
  return blobClient;
}

async function readText(path) {
  try {
    const blockBlobClient = getBlobClient().getBlockBlobClient(path.startsWith('/') ? path.slice(1) : path);
    const response = await blockBlobClient.download();
    const chunks = [];
    for await (const chunk of response.readableStreamBody) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function writeText(path, content) {
  const blockBlobClient = getBlobClient().getBlockBlobClient(path.startsWith('/') ? path.slice(1) : path);
  await blockBlobClient.upload(content, Buffer.byteLength(content, 'utf8'));
}

// Date utilities
function ymd(isoStr) {
  return isoStr.slice(0, 10);
}

function ddmmyyyy(isoStr) {
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function weekOf(slotId) {
  // Extract week from slot like "2025-W39-Tue-AM"
  const match = slotId.match(/(\d{4}-W\d{2})/);
  return match ? match[1] : null;
}

// Table management helpers
const ensureTableCurrent = (sec) => {
  const header = `| Slot-ID           | Task | Kategorie | Deadline |\n|-------------------|:-----|:----------|:--------|\n`;
  if (!sec) return header;
  if (sec.includes("| Slot-ID") && sec.includes("|---")) return sec;
  return `## Dummy\n${header}`.split("\n").slice(1).join("\n");
};

const appendRow = (sec, row) => {
  const lines = sec.trim().split("\n"); 
  lines.push(row); 
  return lines.join("\n");
};

const removeRowByRelLink = (sec, rel) => 
  sec.split("\n").filter(l => !l.includes(`](${rel})`)).join("\n");

const extractWeek = (content, week) => {
  const lines = content.split("\n");
  let inSection = false;
  let sectionLines = [];
  
  for (const line of lines) {
    if (line.startsWith(`## Woche ${week}`)) {
      inSection = true;
      sectionLines.push(line);
    } else if (inSection && line.startsWith("## Woche ")) {
      break;
    } else if (inSection) {
      sectionLines.push(line);
    }
  }
  
  return sectionLines.length > 0 ? sectionLines.join("\n") : null;
};

const replaceWeek = (content, week, newSection) => {
  const lines = content.split("\n");
  let result = [];
  let inSection = false;
  let found = false;
  
  for (const line of lines) {
    if (line.startsWith(`## Woche ${week}`)) {
      inSection = true;
      found = true;
      result.push(...newSection.split("\n"));
    } else if (inSection && line.startsWith("## Woche ")) {
      inSection = false;
      result.push(line);
    } else if (!inSection) {
      result.push(line);
    }
  }
  
  if (!found) {
    result.push("");
    result.push(...newSection.split("\n"));
  }
  
  return result.join("\n");
};

// Action Functions
async function createTask(body) {
  const { 
    list, id, title, created_at_iso, scheduled_slot, category, 
    deadline_iso, project, azure_devops, requester, duration_slots = 1 
  } = body;
  
  if (!list || !id || !title || !created_at_iso || !scheduled_slot) {
    throw new Error("missing fields");
  }

  // Generate file paths
  const year = ymd(created_at_iso).slice(0, 4);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const relTask = `./tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;
  const absTask = `codex-miroir/${list}/tasks/${year}/${ymd(created_at_iso)}--${id}-${slug}.md`;

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
  
  const taskMD = matter.stringify(
    `## Notiz\n\nkurz…\n\n## Verlauf\n- ${ddmmyyyy(created_at_iso)} → geplant in \`${scheduled_slot}\`\n`,
    fm
  );
  await writeText(absTask, taskMD);

  // Update current.md
  const week = weekOf(scheduled_slot);
  const currentPath = `codex-miroir/${list}/current.md`;
  let current = await readText(currentPath) || `# Codex Miroir — CURRENT (${list})\n\n> Aktueller Slot: \`${scheduled_slot}\`\n`;
  let sec = extractWeek(current, week) || `## Woche ${week}\n${ensureTableCurrent("")}`;
  
  const row = `| ${scheduled_slot.padEnd(19)} | [${id}: ${title}](${relTask}) | ${category || ""} | ${deadline_iso ? ddmmyyyy(deadline_iso) : ""} |`;
  sec = appendRow(sec, row);
  current = replaceWeek(current, week, sec);
  await writeText(currentPath, current);

  return { ok: true, taskPath: absTask, currentPath };
}

async function completeTask(body) {
  const { list, taskPathAbs, closed_at_iso } = body;
  if (!list || !taskPathAbs || !closed_at_iso) throw new Error("missing fields");

  // Update task file
  const md = await readText(taskPathAbs);
  if (!md) throw new Error("task not found");
  
  const parsed = matter(md); 
  const fm = parsed.data;
  fm.status = "abgeschlossen";
  fm.closed_at = ddmmyyyy(closed_at_iso);
  
  const verlauf = `## Verlauf\n- ${fm.created_at} → geplant in \`${fm.scheduled_slot}\`\n- ${ddmmyyyy(closed_at_iso)} → abgeschlossen\n`;
  const updatedMD = matter.stringify(parsed.content.replace(/## Verlauf[\s\S]*/, verlauf), fm);
  await writeText(taskPathAbs, updatedMD);

  // Remove from current.md and add to archive.md
  const currentPath = `codex-miroir/${list}/current.md`;
  const archivePath = `codex-miroir/${list}/archive.md`;
  
  let current = await readText(currentPath) || "";
  const week = weekOf(fm.scheduled_slot);
  let sec = extractWeek(current, week);
  
  if (sec) {
    const relPath = taskPathAbs.replace(`codex-miroir/${list}/`, "./");
    sec = removeRowByRelLink(sec, relPath);
    current = replaceWeek(current, week, sec);
    await writeText(currentPath, current);
  }

  // Add to archive
  let archive = await readText(archivePath) || `# Codex Miroir — ARCHIVE (${list})\n\n`;
  let archiveSec = extractWeek(archive, week) || `## Woche ${week}\n${ensureTableCurrent("")}`;
  
  const relTask = taskPathAbs.replace(`codex-miroir/${list}/`, "./");
  const row = `| ${fm.scheduled_slot.padEnd(19)} | [${fm.id}: ${fm.title}](${relTask}) | ${fm.category_pro || fm.category_priv || ""} | ${fm.deadline || ""} |`;
  archiveSec = appendRow(archiveSec, row);
  archive = replaceWeek(archive, week, archiveSec);
  await writeText(archivePath, archive);

  return { ok: true };
}

async function pushToEnd(body) {
  const { list, taskPathAbs, new_scheduled_slot } = body;
  if (!list || !taskPathAbs || !new_scheduled_slot) throw new Error("missing fields");

  // Update task file
  const md = await readText(taskPathAbs);
  if (!md) throw new Error("task not found");
  
  const parsed = matter(md);
  const fm = parsed.data;
  const oldSlot = fm.scheduled_slot;
  fm.scheduled_slot = new_scheduled_slot;
  
  const verlauf = parsed.content.replace(/## Verlauf[\s\S]*/, 
    `## Verlauf\n- ${fm.created_at} → geplant in \`${oldSlot}\`\n- ${ddmmyyyy(new Date().toISOString())} → verschoben nach \`${new_scheduled_slot}\`\n`
  );
  const updatedMD = matter.stringify(verlauf, fm);
  await writeText(taskPathAbs, updatedMD);

  // Update current.md - remove from old week, add to new week
  const currentPath = `codex-miroir/${list}/current.md`;
  let current = await readText(currentPath) || `# Codex Miroir — CURRENT (${list})\n\n`;
  
  // Remove from old week
  const oldWeek = weekOf(oldSlot);
  let oldSec = extractWeek(current, oldWeek);
  if (oldSec) {
    const relPath = taskPathAbs.replace(`codex-miroir/${list}/`, "./");
    oldSec = removeRowByRelLink(oldSec, relPath);
    current = replaceWeek(current, oldWeek, oldSec);
  }
  
  // Add to new week
  const newWeek = weekOf(new_scheduled_slot);
  let newSec = extractWeek(current, newWeek) || `## Woche ${newWeek}\n${ensureTableCurrent("")}`;
  
  const relTask = taskPathAbs.replace(`codex-miroir/${list}/`, "./");
  const row = `| ${new_scheduled_slot.padEnd(19)} | [${fm.id}: ${fm.title}](${relTask}) | ${fm.category_pro || fm.category_priv || ""} | ${fm.deadline || ""} |`;
  newSec = appendRow(newSec, row);
  current = replaceWeek(current, newWeek, newSec);
  await writeText(currentPath, current);

  return { ok: true };
}

async function report(body) {
  const { list } = body;
  if (!list) throw new Error("missing list parameter");

  const currentPath = `codex-miroir/${list}/current.md`;
  const current = await readText(currentPath);
  
  if (!current) {
    return { tasks: [], message: `Keine Tasks gefunden für ${list}` };
  }

  // Parse current tasks from markdown
  const tasks = [];
  const lines = current.split('\n');
  
  for (const line of lines) {
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

  return { tasks, total: tasks.length };
}

async function when(body) {
  const { list } = body;
  if (!list) throw new Error("missing list parameter");

  // Get next available slot logic - simplified for now
  const now = new Date();
  const currentWeek = now.getFullYear() + "-W" + String(Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0');
  
  // Business hours logic
  if (list === "pro") {
    return { nextSlot: `${currentWeek}-Mon-AM`, message: "Nächster verfügbarer Slot: Montag Vormittag" };
  } else {
    return { nextSlot: `${currentWeek}-Mon-PM`, message: "Nächster verfügbarer Slot: Montag Abend" };
  }
}

// Main Azure Function handler
module.exports = async function (context, req) {
  context.log('Codex Miroir function triggered');

  try {
    // Authentication
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!API_KEY || apiKey !== API_KEY) {
      context.res = {
        status: 401,
        body: { error: "Unauthorized" }
      };
      return;
    }

    const action = req.query.action;
    const body = req.body || {};

    let result;
    switch (action) {
      case 'createTask':
        result = await createTask(body);
        break;
      case 'completeTask':
        result = await completeTask(body);
        break;
      case 'pushToEnd':
        result = await pushToEnd(body);
        break;
      case 'report':
        result = await report(body);
        break;
      case 'when':
        result = await when(body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: result
    };

  } catch (error) {
    context.log.error('Error:', error);
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};