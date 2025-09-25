/**
 * LLM-spezifische Funktionen - Voice Commands und AI Integration
 * 
 * Diese Datei enthält alle KI- und sprachbasierte Funktionen:
 * - processCommand: Verarbeitet deutsche Sprachbefehle mit OpenAI
 * - decomposeTask: Zerlegt große Tasks in 3.5h-Blöcke
 * - getCurrentTask: Liefert sprachoptimierte aktuelle Task-Info
 * - Speech-to-text Integration und Fallback-Pattern-Matching
 */

const axios = require("axios");
const matter = require("gray-matter");
const { 
  validateToken, 
  getUserContainerPath, 
  generateTaskId,
  getNextSlot,
  readText,
  ddmmyyyy 
} = require('./helpers');
const { createTask } = require('./markdownCrud');

// Environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ============================================================================
// VOICE COMMAND PROCESSING
// ============================================================================

/**
 * Verarbeitet natürlichsprachige deutsche Kommandos mit KI oder Fallback
 * @param {Object} body - Request Body mit text und list
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Analysiertes Kommando mit Aktion und Parametern
 */
async function processCommand(body, token) {
  const { text, list } = body;
  
  // Validate required fields
  if (!text || !list) {
    throw new Error("missing required fields: text, list");
  }

  // Validate token
  validateToken(token);

  // AI-powered processing with OpenAI GPT
  if (OPENAI_API_KEY) {
    try {
      return await processCommandWithAI(text, list, token);
    } catch (error) {
      console.warn('AI processing failed, using fallback:', error.message);
      // Fall back to pattern matching
      return simpleCommandProcessing(text, list, token);
    }
  } else {
    // Direct fallback if no API key configured
    return simpleCommandProcessing(text, list, token);
  }
}

/**
 * Verarbeitet Kommandos mit OpenAI GPT-4 für intelligente Spracherkennung
 * @param {string} text - Gesprochener/eingegebener Text
 * @param {string} list - Liste (pro/priv)
 * @param {string} token - User Token
 * @returns {Promise<Object>} AI-analysierte Antwort
 */
async function processCommandWithAI(text, list, token) {
  const prompt = `Du bist ein deutscher Task-Management-Assistent für "Codex Miroir".
Analysiere diesen Sprachbefehl: "${text}"
Modus: ${list} (pro = beruflich, priv = privat)

Verfügbare Aktionen:
- create_task: Neue Aufgabe erstellen
- complete_task: Aktuelle Aufgabe abschließen  
- push_to_end: Aufgabe ans Ende verschieben
- get_status: Status abfragen

Kategorien für Tasks:
- pro: programmierung, meeting, planung, dokumentation, review
- priv: haushalt, projekt, einkauf, termine, lernen

Antworte in JSON mit:
- intent: erkannte Aktion
- parameters: extrahierte Parameter (title, category, etc.)
- response: deutsche Antwort für den User (freundlich und präzise)
- confidence: Konfidenz 0-1

Beispiel:
Eingabe: "Erstelle eine neue Aufgabe: Meeting vorbereiten"
Ausgabe: {"intent": "create_task", "parameters": {"title": "Meeting vorbereiten", "category": "meeting"}, "response": "Ich erstelle die Aufgabe 'Meeting vorbereiten' für dich.", "confidence": 0.95}`;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 500
  }, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000 // 10 second timeout
  });
  
  const result = JSON.parse(response.data.choices[0].message.content);
  
  // Execute recognized action if needed
  if (result.intent === 'create_task' && result.parameters.title) {
    try {
      const taskId = generateTaskId();
      await createTask({
        list,
        id: taskId,
        title: result.parameters.title,
        created_at_iso: new Date().toISOString(),
        scheduled_slot: getNextSlot(list),
        category: result.parameters.category || (list === 'pro' ? 'allgemein' : 'projekt')
      }, token);
      
      result.executed = true;
      result.taskId = taskId;
      result.response += ` Task-ID: ${taskId}`;
    } catch (error) {
      result.executed = false;
      result.error = error.message;
      result.response = `Fehler beim Erstellen der Aufgabe: ${error.message}`;
    }
  }
  
  result.aiProcessed = true;
  return result;
}

/**
 * Fallback Pattern-Matching für deutsche Sprachkommandos
 * @param {string} text - Gesprochener/eingegebener Text
 * @param {string} list - Liste (pro/priv)
 * @param {string} token - User Token
 * @returns {Object} Pattern-basierte Analyse
 */
function simpleCommandProcessing(text, list, token) {
  const lowerText = text.toLowerCase();
  
  // Task creation patterns
  if (lowerText.includes('erstelle') || lowerText.includes('neue aufgabe') || 
      lowerText.includes('neuen task') || lowerText.includes('aufgabe:')) {
    
    // Extract title after keywords
    const titlePatterns = [
      /(?:erstelle(?:\s+(?:eine|einen|die|das|eine\s+neue)?)?\s*(?:aufgabe|task)[:\s]+)(.+)/i,
      /(?:neue(?:r)?\s*(?:aufgabe|task)[:\s]+)(.+)/i,
      /(?:aufgabe[:\s]+)(.+)/i,
      /(?:task[:\s]+)(.+)/i
    ];
    
    let title = text;
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        title = match[1].trim();
        break;
      }
    }
    
    // Infer category from title content
    let category = 'allgemein';
    if (list === 'pro') {
      if (lowerText.includes('meeting') || lowerText.includes('besprechung')) category = 'meeting';
      else if (lowerText.includes('code') || lowerText.includes('programmier') || lowerText.includes('entwickl')) category = 'programmierung';
      else if (lowerText.includes('doku') || lowerText.includes('schreib')) category = 'dokumentation';
      else if (lowerText.includes('plan') || lowerText.includes('konzept')) category = 'planung';
    } else {
      if (lowerText.includes('haushalt') || lowerText.includes('putz') || lowerText.includes('küche')) category = 'haushalt';
      else if (lowerText.includes('einkauf') || lowerText.includes('besorg')) category = 'einkauf';
      else if (lowerText.includes('termin') || lowerText.includes('arzt')) category = 'termine';
      else category = 'projekt';
    }
    
    return {
      intent: 'create_task',
      parameters: { title, category },
      response: `Ich erstelle die ${list === 'pro' ? 'berufliche' : 'private'} Aufgabe "${title}" (Kategorie: ${category}) für dich.`,
      confidence: 0.8,
      fallback: true
    };
  }
  
  // Task completion patterns
  if (lowerText.includes('abschließ') || lowerText.includes('fertig') || 
      lowerText.includes('erledigt') || lowerText.includes('complete')) {
    return {
      intent: 'complete_task',
      parameters: {},
      response: 'Ich schließe die aktuelle Aufgabe ab.',
      confidence: 0.8,
      fallback: true
    };
  }
  
  // Task postponement patterns
  if (lowerText.includes('verschieb') || lowerText.includes('später') || 
      lowerText.includes('push') || lowerText.includes('ans ende')) {
    return {
      intent: 'push_to_end',
      parameters: {},
      response: 'Ich verschiebe die aktuelle Aufgabe ans Ende der Warteschlange.',
      confidence: 0.8,
      fallback: true
    };
  }
  
  // Status query patterns
  if (lowerText.includes('status') || lowerText.includes('was steht an') || 
      lowerText.includes('aufgaben') || lowerText.includes('übersicht') ||
      lowerText.includes('was ist zu tun')) {
    return {
      intent: 'get_status',
      parameters: {},
      response: `Hier ist deine ${list === 'pro' ? 'berufliche' : 'private'} Übersicht.`,
      confidence: 0.8,
      fallback: true
    };
  }
  
  // Unknown command
  return {
    intent: 'unknown',
    parameters: {},
    response: 'Entschuldigung, ich habe dich nicht verstanden. Versuche es mit:\n• "Erstelle Aufgabe: [Titel]"\n• "Aktuelle Aufgabe abschließen"\n• "Status anzeigen"\n• "Aufgabe verschieben"',
    confidence: 0.1,
    fallback: true
  };
}

// ============================================================================
// TASK DECOMPOSITION
// ============================================================================

/**
 * Zerlegt große Tasks in kleinere 3.5-Stunden-Blöcke mit KI
 * @param {Object} body - Request Body mit Task-Details
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Aufgeteilte Subtasks
 */
async function decomposeTask(body, token) {
  const { list, title, description, estimated_hours } = body;
  
  // Validate required fields
  if (!title) throw new Error("missing required field: title");
  
  // Validate token
  validateToken(token);

  // AI-powered decomposition with OpenAI
  if (OPENAI_API_KEY) {
    try {
      return await decomposeTaskWithAI(title, description, estimated_hours, list);
    } catch (error) {
      console.warn('AI decomposition failed, using fallback:', error.message);
      return simpleTaskDecomposition(title, estimated_hours);
    }
  } else {
    return simpleTaskDecomposition(title, estimated_hours);
  }
}

/**
 * KI-basierte Task-Zerlegung mit OpenAI GPT-4
 * @param {string} title - Task-Titel
 * @param {string} description - Task-Beschreibung
 * @param {number} estimated_hours - Geschätzte Stunden
 * @param {string} list - Liste (pro/priv)
 * @returns {Promise<Object>} AI-optimierte Subtasks
 */
async function decomposeTaskWithAI(title, description, estimated_hours, list) {
  const prompt = `Du bist ein Experte für Task Management und Zeitplanung.
Zerlege diese Aufgabe in kleinere Teilaufgaben à maximal 3.5 Stunden (1 Codex Miroir Slot):

Titel: ${title}
Beschreibung: ${description || 'Keine Beschreibung'}
Geschätzte Gesamtzeit: ${estimated_hours || 'Unbekannt'} Stunden
Kontext: ${list === 'pro' ? 'Beruflich' : 'Privat'}

Regeln:
- Jede Teilaufgabe maximal 3.5 Stunden
- Logische Reihenfolge beachten
- Klare, ausführbare Titel
- Deutsche Sprache
- Realistische Zeitschätzungen

Antworte in JSON:
{
  "subtasks": [
    {"title": "Konkrete Teilaufgabe 1", "estimated_hours": 3.0, "order": 1, "description": "Kurze Beschreibung"},
    {"title": "Konkrete Teilaufgabe 2", "estimated_hours": 2.5, "order": 2, "description": "Kurze Beschreibung"}
  ],
  "total_slots": 2,
  "notes": "Zusätzliche Hinweise zur Umsetzung"
}`;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1000
  }, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000 // 15 second timeout for complex processing
  });
  
  const result = JSON.parse(response.data.choices[0].message.content);
  result.aiGenerated = true;
  return result;
}

/**
 * Einfache Fallback-Zerlegung ohne KI
 * @param {string} title - Task-Titel
 * @param {number} estimated_hours - Geschätzte Stunden
 * @returns {Object} Einfache Subtask-Zerlegung
 */
function simpleTaskDecomposition(title, estimated_hours) {
  const hours = estimated_hours || 7; // Default assumption
  const numSlots = Math.ceil(hours / 3.5);
  
  const subtasks = [];
  for (let i = 0; i < numSlots; i++) {
    const isLast = i === numSlots - 1;
    const slotHours = isLast ? hours - (i * 3.5) : 3.5;
    
    subtasks.push({
      title: `${title} - Teil ${i + 1}`,
      estimated_hours: Math.min(slotHours, 3.5),
      order: i + 1,
      description: `Automatisch generierte Teilaufgabe ${i + 1} von ${numSlots}`
    });
  }
  
  return {
    subtasks,
    total_slots: numSlots,
    notes: "Automatische Aufgabenteilung (KI nicht verfügbar)",
    fallback: true
  };
}

// ============================================================================
// CURRENT TASK INFO (VOICE-OPTIMIZED)
// ============================================================================

/**
 * Liefert sprachoptimierte Informationen über die aktuelle Task
 * @param {Object} body - Request Body mit list Parameter
 * @param {string} token - User Token für Authentication
 * @returns {Promise<Object>} Voice-optimierte Task-Informationen
 */
async function getCurrentTask(body, token) {
  const { list } = body;
  if (!list) throw new Error("missing required parameter: list");

  // Validate token
  validateToken(token);

  const userContainerPath = getUserContainerPath(token, list);
  const currentPath = `${userContainerPath}/current.md`;
  const current = await readText(currentPath);
  
  if (!current) {
    const listType = list === 'pro' ? 'beruflichen' : 'privaten';
    return { 
      hasTask: false, 
      message: `Keine aktuellen Aufgaben in der ${listType} Liste.`,
      voiceResponse: `Du hast derzeit keine ${listType} Aufgaben geplant.`,
      listType: list
    };
  }

  // Parse current tasks from markdown - get the first one (most current)
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
      voiceResponse: "Ich kann keine aktuelle Aufgabe finden.",
      listType: list
    };
  }

  // Try to get additional task details from file
  let taskDetails = null;
  try {
    const taskMd = await readText(`${userContainerPath}/${currentTask.taskPath.replace('./', '')}`);
    if (taskMd) {
      const parsed = matter(taskMd);
      taskDetails = parsed.data;
    }
  } catch (error) {
    // Ignore file reading errors, continue with basic info
  }

  // Generate voice-optimized response
  const listType = list === 'pro' ? 'berufliche' : 'private';
  let voiceResponse = `Deine aktuelle ${listType} Aufgabe ist: ${currentTask.task}. `;
  voiceResponse += `Geplant für ${currentTask.slot}`;
  
  if (currentTask.deadline) {
    voiceResponse += `, Deadline ${currentTask.deadline}`;
  }
  voiceResponse += '.';
  
  if (currentTask.category) {
    voiceResponse += ` Kategorie: ${currentTask.category}.`;
  }

  return {
    hasTask: true,
    currentTask,
    taskDetails,
    listType: list,
    message: `Aktuelle Aufgabe: ${currentTask.task}`,
    voiceResponse,
    slot: currentTask.slot,
    deadline: currentTask.deadline,
    category: currentTask.category
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  processCommand,
  decomposeTask,
  getCurrentTask
};