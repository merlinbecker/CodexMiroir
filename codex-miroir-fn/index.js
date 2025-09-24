const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");
const axios = require("axios");

// Environment & Authentication
const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";
const API_KEY = process.env.API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

// Utility function to generate task IDs
function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `T-${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
}

// Utility function to get next available slot
function getNextSlot(list) {
  const now = new Date();
  const currentWeek = now.getFullYear() + "-W" + String(Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0');
  
  if (list === "pro") {
    return `${currentWeek}-Mon-AM`;
  } else {
    return `${currentWeek}-Mon-PM`;
  }
}

// Voice Command Processing
async function processCommand(body) {
  const { text, list } = body;
  if (!text || !list) throw new Error("missing text or list parameter");

  const prompt = `Du bist ein deutscher Task-Management-Assistent für "Codex Miroir".
Analysiere diesen Sprachbefehl: "${text}"
Modus: ${list} (pro = beruflich, priv = privat)

Verfügbare Aktionen:
- create_task: Neue Aufgabe erstellen
- complete_task: Aktuelle Aufgabe abschließen  
- push_to_end: Aufgabe ans Ende verschieben
- get_status: Status abfragen

Antworte in JSON mit:
- intent: erkannte Aktion
- parameters: extrahierte Parameter (title, category, etc.)
- response: deutsche Antwort für den User
- confidence: Konfidenz 0-1

Beispiel:
Eingabe: "Erstelle eine neue Aufgabe: Meeting vorbereiten"
Ausgabe: {"intent": "create_task", "parameters": {"title": "Meeting vorbereiten", "category": "meeting"}, "response": "Ich erstelle die Aufgabe 'Meeting vorbereiten' für dich.", "confidence": 0.95}`;

  try {
    if (!OPENAI_API_KEY) {
      // Fallback: Simple pattern matching
      return simpleCommandProcessing(text, list);
    }

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = JSON.parse(response.data.choices[0].message.content);
    
    // Execute recognized action
    if (result.intent === 'create_task' && result.parameters.title) {
      const taskId = generateTaskId();
      await createTask({
        list,
        id: taskId,
        title: result.parameters.title,
        created_at_iso: new Date().toISOString(),
        scheduled_slot: getNextSlot(list),
        category: result.parameters.category || (list === 'pro' ? 'allgemein' : 'projekt')
      });
      result.executed = true;
      result.taskId = taskId;
    }
    
    return result;
  } catch (error) {
    // Fallback to simple processing
    return simpleCommandProcessing(text, list);
  }
}

// Simple command processing fallback
function simpleCommandProcessing(text, list) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('erstelle') || lowerText.includes('neue aufgabe') || lowerText.includes('task')) {
    // Extract title after keywords
    const titleMatch = text.match(/(?:erstelle|aufgabe|task)[:\s]+(.+)/i);
    const title = titleMatch ? titleMatch[1].trim() : text;
    
    return {
      intent: 'create_task',
      parameters: { title, category: 'allgemein' },
      response: `Ich erstelle die Aufgabe "${title}" für dich.`,
      confidence: 0.8,
      fallback: true
    };
  }
  
  if (lowerText.includes('abschließ') || lowerText.includes('fertig') || lowerText.includes('complete')) {
    return {
      intent: 'complete_task',
      parameters: {},
      response: 'Ich schließe die aktuelle Aufgabe ab.',
      confidence: 0.8,
      fallback: true
    };
  }
  
  if (lowerText.includes('verschieb') || lowerText.includes('später') || lowerText.includes('push')) {
    return {
      intent: 'push_to_end',
      parameters: {},
      response: 'Ich verschiebe die Aufgabe ans Ende der Warteschlange.',
      confidence: 0.8,
      fallback: true
    };
  }
  
  if (lowerText.includes('status') || lowerText.includes('was steht an') || lowerText.includes('aufgaben')) {
    return {
      intent: 'get_status',
      parameters: {},
      response: 'Hier ist dein aktueller Status.',
      confidence: 0.8,
      fallback: true
    };
  }
  
  return {
    intent: 'unknown',
    parameters: {},
    response: 'Entschuldigung, ich habe dich nicht verstanden. Versuche es mit "Erstelle Aufgabe: [Titel]" oder "Status anzeigen".',
    confidence: 0.1,
    fallback: true
  };
}

// Task Decomposition using AI
async function decomposeTask(body) {
  const { list, title, description, estimated_hours } = body;
  if (!title) throw new Error("missing title parameter");

  const prompt = `Du bist ein Experte für Task Management und Zeitplanung.
Zerlege diese Aufgabe in kleinere Teilaufgaben à 3.5 Stunden (1 Slot):

Titel: ${title}
Beschreibung: ${description || 'Keine Beschreibung'}
Geschätzte Gesamtzeit: ${estimated_hours || 'Unbekannt'} Stunden
Kontext: ${list === 'pro' ? 'Beruflich' : 'Privat'}

Regeln:
- Jede Teilaufgabe max. 3.5 Stunden
- Logische Reihenfolge
- Klare, actionable Titel
- Deutsche Sprache

Antworte in JSON:
{
  "subtasks": [
    {"title": "Teilaufgabe 1", "estimated_hours": 3.5, "order": 1},
    {"title": "Teilaufgabe 2", "estimated_hours": 2.0, "order": 2}
  ],
  "total_slots": 2,
  "notes": "Zusätzliche Hinweise"
}`;

  try {
    if (!OPENAI_API_KEY) {
      // Fallback: Simple decomposition
      return {
        subtasks: [
          { title: `${title} - Teil 1`, estimated_hours: 3.5, order: 1 },
          { title: `${title} - Teil 2`, estimated_hours: Math.min(estimated_hours - 3.5 || 3.5, 3.5), order: 2 }
        ],
        total_slots: Math.ceil((estimated_hours || 7) / 3.5),
        notes: "Automatische Aufgabenteilung (AI nicht verfügbar)",
        fallback: true
      };
    }

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    // Fallback
    return {
      subtasks: [
        { title: `${title} - Teil 1`, estimated_hours: 3.5, order: 1 },
        { title: `${title} - Teil 2`, estimated_hours: Math.min(estimated_hours - 3.5 || 3.5, 3.5), order: 2 }
      ],
      total_slots: Math.ceil((estimated_hours || 7) / 3.5),
      notes: "Fallback-Aufgabenteilung (AI-Fehler)",
      fallback: true,
      error: error.message
    };
  }
}

// Voice-optimized Current Task
async function getCurrentTask(body) {
  const { list } = body;
  if (!list) throw new Error("missing list parameter");

  const currentPath = `codex-miroir/${list}/current.md`;
  const current = await readText(currentPath);
  
  if (!current) {
    return { 
      hasTask: false, 
      message: `Keine aktuellen Aufgaben in der ${list === 'pro' ? 'beruflichen' : 'privaten'} Liste.`,
      voiceResponse: `Du hast derzeit keine ${list === 'pro' ? 'beruflichen' : 'privaten'} Aufgaben geplant.`
    };
  }

  // Parse current tasks from markdown - get the first one
  const lines = current.split('\n');
  let currentTask = null;
  
  for (const line of lines) {
    if (line.includes('|') && line.includes('[') && line.includes('](')) {
      const match = line.match(/\|\s*([^|]+)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/);
      if (match) {
        currentTask = {
          slot: match[1].trim(),
          task: match[2].trim(),
          taskPath: match[3].trim(),
          category: match[4].trim(),
          deadline: match[5].trim()
        };
        break; // Take first task (current)
      }
    }
  }

  if (!currentTask) {
    return { 
      hasTask: false, 
      message: "Keine aktuelle Aufgabe gefunden.",
      voiceResponse: "Ich kann keine aktuelle Aufgabe finden."
    };
  }

  // Try to get task details from file
  let taskDetails = null;
  try {
    const taskMd = await readText(`codex-miroir/${list}/${currentTask.taskPath.replace('./', '')}`);
    if (taskMd) {
      const parsed = matter(taskMd);
      taskDetails = parsed.data;
    }
  } catch (error) {
    // Ignore file reading errors
  }

  const voiceResponse = `Deine aktuelle ${list === 'pro' ? 'berufliche' : 'private'} Aufgabe ist: ${currentTask.task}. 
Geplant für ${currentTask.slot}${currentTask.deadline ? `, Deadline ${currentTask.deadline}` : ''}.
${currentTask.category ? `Kategorie: ${currentTask.category}.` : ''}`;

  return {
    hasTask: true,
    currentTask,
    taskDetails,
    message: `Aktuelle Aufgabe: ${currentTask.task}`,
    voiceResponse,
    slot: currentTask.slot,
    deadline: currentTask.deadline
  };
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
      case 'processCommand':
        result = await processCommand(body);
        break;
      case 'decomposeTask':
        result = await decomposeTask(body);
        break;
      case 'getCurrentTask':
        result = await getCurrentTask(body);
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