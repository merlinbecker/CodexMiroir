/**
 * CodexMiroir Backend - Hauptmodul für Azure Functions
 * 
 * Diese Datei orchestriert alle Backend-Operationen für das Task-Management-System.
 * Verwendet modulare Architektur mit sauberer Trennung der Verantwortlichkeiten:
 * 
 * - helpers.js: Globale Utility-Funktionen
 * - markdownCrud.js: CRUD-Operationen für Markdown-Tasks
 * - llmActions.js: KI-basierte Sprachverarbeitung und LLM-Integration
 */

// Import der modularen Komponenten nach Clean Code Prinzipien
const { validateToken } = require('./helpers');
const { 
  createTask, 
  completeTask, 
  pushToEnd, 
  report, 
  when 
} = require('./markdownCrud');
const { 
  processCommand, 
  decomposeTask, 
  getCurrentTask 
} = require('./llmActions');

// ============================================================================
// MAIN AZURE FUNCTION HANDLER - Request Orchestration
// ============================================================================

/**
 * Hauptfunktion für Azure Functions - orchestriert alle API-Requests
 * @param {Object} context - Azure Function Context
 * @param {Object} req - HTTP Request Object
 */
module.exports = async function (context, req) {
  context.log('CodexMiroir Backend - API Request verarbeitet:', {
    method: req.method,
    action: req.query.action,
    hasToken: !!req.params.token,
    timestamp: new Date().toISOString()
  });

  try {
    // Token-basierte Authentication aus URL-Pfad extrahieren
    const token = req.params.token;
    if (!token) {
      context.res = {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { 
          error: "Token fehlt im URL-Pfad", 
          message: "Bitte Token in der URL angeben: /api/codex/{token}?action=..." 
        }
      };
      return;
    }

    // Token validieren vor weiterer Verarbeitung
    try {
      validateToken(token);
    } catch (error) {
      context.log.warn('Token Validation Fehler:', error.message);
      context.res = {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { 
          error: "Token ungültig", 
          details: error.message 
        }
      };
      return;
    }

    // Request-Parameter extrahieren
    const action = req.query.action;
    const body = req.body || {};
    
    context.log('Processing action:', action, 'with body:', Object.keys(body));

    // Action-basiertes Routing zu den entsprechenden Modulen
    let result;
    let processingStartTime = Date.now();

    switch (action) {
      // CRUD-Operationen für Markdown-Tasks (markdownCrud.js)
      case 'createTask':
        result = await createTask(body, token);
        break;
      case 'completeTask':
        result = await completeTask(body, token);
        break;
      case 'pushToEnd':
        result = await pushToEnd(body, token);
        break;
      case 'report':
        result = await report(body, token);
        break;
      case 'when':
        result = await when(body, token);
        break;

      // LLM-spezifische Aktionen (llmActions.js)
      case 'processCommand':
        result = await processCommand(body, token);
        break;
      case 'decomposeTask':
        result = await decomposeTask(body, token);
        break;
      case 'getCurrentTask':
        result = await getCurrentTask(body, token);
        break;

      default:
        throw new Error(`Unbekannte Aktion: ${action}. Verfügbare Aktionen: createTask, completeTask, pushToEnd, report, when, processCommand, decomposeTask, getCurrentTask`);
    }

    // Performance-Logging
    const processingTime = Date.now() - processingStartTime;
    context.log('Request erfolgreich verarbeitet:', {
      action,
      processingTimeMs: processingTime,
      hasResult: !!result
    });

    // Erfolgreiche Antwort mit Performance-Metadaten
    context.res = {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Processing-Time-Ms': processingTime.toString(),
        'X-CodexMiroir-Version': '2.0.0-modular'
      },
      body: {
        ...result,
        meta: {
          action,
          processingTime: `${processingTime}ms`,
          timestamp: new Date().toISOString()
        }
      }
    };

  } catch (error) {
    // Comprehensive Error Handling mit Logging
    context.log.error('Backend Fehler:', {
      message: error.message,
      stack: error.stack,
      action: req.query.action,
      method: req.method
    });

    // User-freundliche Fehlermeldungen
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorResponse = {
      error: "Request konnte nicht verarbeitet werden",
      message: error.message,
      action: req.query.action || 'unknown',
      timestamp: new Date().toISOString()
    };

    // Stack Trace nur in Development
    if (isDevelopment) {
      errorResponse.stack = error.stack;
    }

    context.res = {
      status: error.code === 401 ? 401 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: errorResponse
    };
  }
};