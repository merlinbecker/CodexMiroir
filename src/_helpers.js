// Common helper functions for Azure Functions

/**
 * Creates a standardized error response
 */
export function errorResponse(e, ctx, customStatus = null) {
  const status = customStatus || 
                 (e.code === 404 ? 404 : 
                  e.code === 409 ? 409 : 500);
  
  ctx.log("Error:", e.constructor.name, "-", e.message);
  
  return {
    status,
    jsonBody: {
      error: String(e.message || e),
      errorType: e.constructor.name,
      errorCode: e.code
    }
  };
}

/**
 * Validates required parameters
 */
export function validateParams(params, ctx) {
  const missing = [];
  
  for (const [key, value] of Object.entries(params)) {
    if (!value && value !== 0 && value !== false) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    ctx.log("ERROR: Missing required parameters:", missing.join(", "));
    return {
      status: 400,
      jsonBody: {
        error: `Missing parameters. Required: ${missing.join(", ")}`
      }
    };
  }
  
  return null;
}

/**
 * Gets the content type for a file based on extension
 */
export function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "text/plain";
}

/**
 * Generates a unique task ID
 */
export function generateTaskId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const moreParts = Math.random().toString(36).substring(2, 15);
  return `task_${timestamp}-${randomPart}-${moreParts}`;
}
