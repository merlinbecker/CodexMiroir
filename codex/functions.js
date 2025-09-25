const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");

// Environment & Authentication
const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";

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

function getNextSlot(list) {
  // Generate next available slot for task scheduling
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Calculate current week number (ISO week)
  const startOfYear = new Date(currentYear, 0, 1);
  const pastDaysOfYear = (now - startOfYear) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  
  // Get current day of week (0=Sun, 1=Mon, etc.)
  const dayOfWeek = now.getDay();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = days[dayOfWeek];
  
  // Determine if we should use AM or PM slot (based on current time)
  const hours = now.getHours();
  const period = hours < 12 ? 'AM' : 'PM';
  
  // Format: YYYY-WNN-DDD-PP (e.g., "2025-W39-Tue-AM")
  return `${currentYear}-W${weekNumber.toString().padStart(2, '0')}-${currentDay}-${period}`;
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

module.exports = {
  createTask,
  readText,
  writeText,
  getBlobClient,
  ymd,
  ddmmyyyy,
  weekOf,
  getNextSlot
};