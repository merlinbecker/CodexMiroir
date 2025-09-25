/**
 * Globale Helfer-Funktionen für das CodexMiroir Backend
 * 
 * Diese Datei enthält alle Utility-Funktionen die von verschiedenen Teilen 
 * der Anwendung benötigt werden:
 * - Storage helpers für Azure Blob Storage
 * - Date utilities für deutsche Datumsformate
 * - Table management helpers für Markdown-Tabellen
 * - Authentication und path generation
 */

const { BlobServiceClient } = require("@azure/storage-blob");

// Environment & Authentication
const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";

// ============================================================================
// AUTHENTICATION & PATH HELPERS
// ============================================================================

/**
 * Validiert den User Token für API-Zugriff
 * @param {string} token - Der zu validierende Token
 * @returns {string} Der validierte Token
 * @throws {Error} Wenn Token ungültig ist
 */
function validateToken(token) {
  if (!token || typeof token !== 'string' || token.length < 8) {
    const e = new Error("invalid or missing token"); 
    e.code = 401; 
    throw e;
  }
  // Additional token validation can be added here (e.g., format check, database lookup)
  return token;
}

/**
 * Generiert user-spezifischen Container-Pfad basierend auf Token
 * @param {string} token - User Token
 * @param {string} list - Liste (pro/priv)
 * @returns {string} Container-Pfad für den User
 */
function getUserContainerPath(token, list) {
  return `users/${token}/codex-miroir/${list}`;
}

// ============================================================================
// STORAGE HELPERS - Azure Blob Storage Integration
// ============================================================================

let blobClient = null;

/**
 * Lazy-initialized Azure Blob Client
 * @returns {ContainerClient} Azure Blob Container Client
 */
function getBlobClient() {
  if (!blobClient) {
    if (!CONN) throw new Error("AZURE_BLOB_CONN not set");
    const serviceClient = BlobServiceClient.fromConnectionString(CONN);
    blobClient = serviceClient.getContainerClient(CONTAINER);
  }
  return blobClient;
}

/**
 * Liest Text-Inhalt einer Datei aus dem Blob Storage
 * @param {string} path - Pfad zur Datei
 * @returns {Promise<string|null>} Datei-Inhalt oder null wenn nicht gefunden
 */
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

/**
 * Schreibt Text-Inhalt in eine Datei im Blob Storage
 * @param {string} path - Pfad zur Datei
 * @param {string} content - Zu schreibender Inhalt
 * @returns {Promise<void>}
 */
async function writeText(path, content) {
  const blockBlobClient = getBlobClient().getBlockBlobClient(path.startsWith('/') ? path.slice(1) : path);
  await blockBlobClient.upload(content, Buffer.byteLength(content, 'utf8'));
}

// ============================================================================
// DATE UTILITIES - Deutsche Datumsformate
// ============================================================================

/**
 * Extrahiert YYYY-MM-DD aus ISO-Datum für Dateipfade
 * @param {string} isoStr - ISO Datetime String
 * @returns {string} YYYY-MM-DD Format
 */
function ymd(isoStr) {
  return isoStr.slice(0, 10);
}

/**
 * Konvertiert ISO-Datum zu deutschem DD.MM.YYYY Format
 * @param {string} isoStr - ISO Datetime String
 * @returns {string} DD.MM.YYYY Format
 */
function ddmmyyyy(isoStr) {
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Extrahiert Woche aus Slot-ID (z.B. "2025-W39-Tue-AM" → "2025-W39")
 * @param {string} slotId - Slot Identifier
 * @returns {string|null} Woche im Format YYYY-WNN oder null
 */
function weekOf(slotId) {
  // Extract week from slot like "2025-W39-Tue-AM"
  const match = slotId.match(/(\d{4}-W\d{2})/);
  return match ? match[1] : null;
}

/**
 * Generiert nächsten verfügbaren Zeitslot für Task-Planung
 * @param {string} list - Liste (pro/priv) 
 * @returns {string} Nächster Slot im Format YYYY-WNN-DDD-PP
 */
function getNextSlot(list) {
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
  
  // Determine if we should use AM or PM slot (based on current time and list type)
  const hours = now.getHours();
  let period;
  
  if (list === "pro") {
    // Professional tasks: prefer business hours
    period = hours < 12 ? 'AM' : 'PM';
  } else {
    // Private tasks: prefer evening/weekend slots
    period = hours < 18 ? 'PM' : 'AM';
  }
  
  // Format: YYYY-WNN-DDD-PP (e.g., "2025-W39-Tue-AM")
  return `${currentYear}-W${weekNumber.toString().padStart(2, '0')}-${currentDay}-${period}`;
}

/**
 * Generiert eindeutige Task-ID basierend auf Timestamp
 * @returns {string} Task-ID im Format T-XXXXXXX
 */
function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `T-${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
}

// ============================================================================
// TABLE MANAGEMENT HELPERS - Markdown Tabellen-Utilities
// ============================================================================

/**
 * Stellt sicher dass Markdown-Sektion eine gültige Tabelle hat
 * @param {string} sec - Markdown-Sektion
 * @returns {string} Sektion mit garantierter Tabelle
 */
const ensureTableCurrent = (sec) => {
  const header = `| Slot-ID           | Task | Kategorie | Deadline |\n|-------------------|:-----|:----------|:--------|\n`;
  if (!sec) return header;
  if (sec.includes("| Slot-ID") && sec.includes("|---")) return sec;
  return `## Dummy\n${header}`.split("\n").slice(1).join("\n");
};

/**
 * Fügt neue Zeile an das Ende einer Tabellen-Sektion hinzu
 * @param {string} sec - Tabellen-Sektion
 * @param {string} row - Neue Zeile
 * @returns {string} Sektion mit angehängter Zeile
 */
const appendRow = (sec, row) => {
  const lines = sec.trim().split("\n"); 
  lines.push(row); 
  return lines.join("\n");
};

/**
 * Entfernt Zeile mit spezifischem relativen Link aus Tabelle
 * @param {string} sec - Tabellen-Sektion
 * @param {string} rel - Relativer Link
 * @returns {string} Sektion ohne die spezifizierte Zeile
 */
const removeRowByRelLink = (sec, rel) => 
  sec.split("\n").filter(l => !l.includes(`](${rel})`)).join("\n");

/**
 * Extrahiert spezifische Woche aus Markdown-Inhalt
 * @param {string} content - Gesamter Markdown-Inhalt
 * @param {string} week - Woche im Format YYYY-WNN
 * @returns {string|null} Wochen-Sektion oder null wenn nicht gefunden
 */
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

/**
 * Ersetzt spezifische Wochen-Sektion in Markdown-Inhalt
 * @param {string} content - Gesamter Markdown-Inhalt
 * @param {string} week - Woche im Format YYYY-WNN
 * @param {string} newSection - Neue Sektion
 * @returns {string} Aktualisierter Markdown-Inhalt
 */
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

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Authentication & Paths
  validateToken,
  getUserContainerPath,
  generateTaskId,
  
  // Storage
  getBlobClient,
  readText,
  writeText,
  
  // Date utilities
  ymd,
  ddmmyyyy,
  weekOf,
  getNextSlot,
  
  // Table management
  ensureTableCurrent,
  appendRow,
  removeRowByRelLink,
  extractWeek,
  replaceWeek
};