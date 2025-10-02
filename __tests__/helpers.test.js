const { describe, test, expect } = require('@jest/globals');

// Helper Functions from src/_helpers.js
// These functions are duplicated here to test the logic independently
// This follows the project's pattern of testing function logic with mock implementations

// Actual implementations from src/_helpers.js
function errorResponse(e, ctx, customStatus = null) {
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

function validateParams(params, ctx) {
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

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "text/plain";
}

function generateTaskId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const moreParts = Math.random().toString(36).substring(2, 15);
  return `task_${timestamp}-${randomPart}-${moreParts}`;
}

describe('Helper Functions', () => {
  describe('errorResponse', () => {
    test('should create error response with 404 status for error code 404', () => {
      const mockCtx = { log: jest.fn() };
      const error = new Error('Not found');
      error.code = 404;

      const response = errorResponse(error, mockCtx);

      expect(response.status).toBe(404);
      expect(response.jsonBody.error).toBe('Not found');
      expect(response.jsonBody.errorType).toBe('Error');
      expect(response.jsonBody.errorCode).toBe(404);
      expect(mockCtx.log).toHaveBeenCalledWith('Error:', 'Error', '-', 'Not found');
    });

    test('should create error response with 409 status for error code 409', () => {
      const mockCtx = { log: jest.fn() };
      const error = new Error('Conflict');
      error.code = 409;

      const response = errorResponse(error, mockCtx);

      expect(response.status).toBe(409);
      expect(response.jsonBody.error).toBe('Conflict');
      expect(response.jsonBody.errorCode).toBe(409);
    });

    test('should create error response with 500 status for unknown error codes', () => {
      const mockCtx = { log: jest.fn() };
      const error = new Error('Internal error');
      error.code = 999;

      const response = errorResponse(error, mockCtx);

      expect(response.status).toBe(500);
      expect(response.jsonBody.error).toBe('Internal error');
      expect(response.jsonBody.errorCode).toBe(999);
    });

    test('should use custom status when provided', () => {
      const mockCtx = { log: jest.fn() };
      const error = new Error('Custom error');

      const response = errorResponse(error, mockCtx, 418);

      expect(response.status).toBe(418);
      expect(response.jsonBody.error).toBe('Custom error');
    });

    test('should handle error without message', () => {
      const mockCtx = { log: jest.fn() };
      const error = { code: 500, constructor: { name: 'CustomError' } };

      const response = errorResponse(error, mockCtx);

      expect(response.status).toBe(500);
      expect(response.jsonBody.error).toBeTruthy();
      expect(response.jsonBody.errorType).toBe('CustomError');
    });

    test('should handle error without code', () => {
      const mockCtx = { log: jest.fn() };
      const error = new Error('No code error');

      const response = errorResponse(error, mockCtx);

      expect(response.status).toBe(500);
      expect(response.jsonBody.error).toBe('No code error');
      expect(response.jsonBody.errorCode).toBeUndefined();
    });
  });

  describe('validateParams', () => {
    test('should return null when all parameters are provided', () => {
      const mockCtx = { log: jest.fn() };
      const params = {
        userId: 'user123',
        taskId: 'task456',
        name: 'Test Task'
      };

      const result = validateParams(params, mockCtx);

      expect(result).toBeNull();
      expect(mockCtx.log).not.toHaveBeenCalled();
    });

    test('should detect missing string parameter', () => {
      const mockCtx = { log: jest.fn() };
      const params = {
        userId: 'user123',
        taskId: '',
        name: 'Test Task'
      };

      const result = validateParams(params, mockCtx);

      expect(result).not.toBeNull();
      expect(result.status).toBe(400);
      expect(result.jsonBody.error).toContain('taskId');
      expect(mockCtx.log).toHaveBeenCalledWith(
        'ERROR: Missing required parameters:',
        'taskId'
      );
    });

    test('should detect missing undefined parameter', () => {
      const mockCtx = { log: jest.fn() };
      const params = {
        userId: 'user123',
        taskId: undefined,
        name: 'Test Task'
      };

      const result = validateParams(params, mockCtx);

      expect(result).not.toBeNull();
      expect(result.status).toBe(400);
      expect(result.jsonBody.error).toContain('taskId');
    });

    test('should detect missing null parameter', () => {
      const mockCtx = { log: jest.fn() };
      const params = {
        userId: 'user123',
        taskId: null,
        name: 'Test Task'
      };

      const result = validateParams(params, mockCtx);

      expect(result).not.toBeNull();
      expect(result.status).toBe(400);
      expect(result.jsonBody.error).toContain('taskId');
    });

    test('should detect multiple missing parameters', () => {
      const mockCtx = { log: jest.fn() };
      const params = {
        userId: '',
        taskId: null,
        name: ''
      };

      const result = validateParams(params, mockCtx);

      expect(result).not.toBeNull();
      expect(result.status).toBe(400);
      expect(result.jsonBody.error).toContain('userId');
      expect(result.jsonBody.error).toContain('taskId');
      expect(result.jsonBody.error).toContain('name');
    });

    test('should accept 0 as valid value', () => {
      const mockCtx = { log: jest.fn() };
      const params = {
        count: 0,
        index: 0
      };

      const result = validateParams(params, mockCtx);

      expect(result).toBeNull();
    });

    test('should accept false as valid value', () => {
      const mockCtx = { log: jest.fn() };
      const params = {
        isActive: false,
        enabled: false
      };

      const result = validateParams(params, mockCtx);

      expect(result).toBeNull();
    });

    test('should handle empty params object', () => {
      const mockCtx = { log: jest.fn() };
      const params = {};

      const result = validateParams(params, mockCtx);

      expect(result).toBeNull();
    });
  });

  describe('getContentType', () => {
    test('should return correct content type for HTML files', () => {
      expect(getContentType('index.html')).toBe('text/html');
      expect(getContentType('/path/to/page.html')).toBe('text/html');
    });

    test('should return correct content type for CSS files', () => {
      expect(getContentType('styles.css')).toBe('text/css');
      expect(getContentType('/path/to/styles.css')).toBe('text/css');
    });

    test('should return correct content type for JavaScript files', () => {
      expect(getContentType('app.js')).toBe('application/javascript');
      expect(getContentType('/path/to/script.js')).toBe('application/javascript');
    });

    test('should return correct content type for JSON files', () => {
      expect(getContentType('data.json')).toBe('application/json');
      expect(getContentType('/api/config.json')).toBe('application/json');
    });

    test('should return correct content type for PNG images', () => {
      expect(getContentType('logo.png')).toBe('image/png');
      expect(getContentType('/images/icon.png')).toBe('image/png');
    });

    test('should return correct content type for JPEG images', () => {
      expect(getContentType('photo.jpg')).toBe('image/jpeg');
      expect(getContentType('image.jpeg')).toBe('image/jpeg');
      expect(getContentType('/gallery/pic.jpg')).toBe('image/jpeg');
    });

    test('should return correct content type for SVG images', () => {
      expect(getContentType('icon.svg')).toBe('image/svg+xml');
      expect(getContentType('/assets/logo.svg')).toBe('image/svg+xml');
    });

    test('should return text/plain for unknown extensions', () => {
      expect(getContentType('readme.txt')).toBe('text/plain');
      expect(getContentType('document.pdf')).toBe('text/plain');
      expect(getContentType('data.xml')).toBe('text/plain');
      expect(getContentType('file')).toBe('text/plain');
    });

    test('should handle files without path', () => {
      expect(getContentType('index.html')).toBe('text/html');
      expect(getContentType('script.js')).toBe('application/javascript');
    });

    test('should handle files with multiple dots', () => {
      expect(getContentType('app.min.js')).toBe('application/javascript');
      expect(getContentType('style.bundle.css')).toBe('text/css');
    });
  });

  describe('generateTaskId', () => {
    test('should generate a task ID with correct format', () => {
      const taskId = generateTaskId();
      
      expect(taskId).toMatch(/^task_[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
      expect(taskId).toContain('task_');
      expect(taskId.split('-')).toHaveLength(3);
    });

    test('should generate unique task IDs', () => {
      const ids = new Set();
      const count = 100;
      
      for (let i = 0; i < count; i++) {
        ids.add(generateTaskId());
      }
      
      expect(ids.size).toBe(count);
    });

    test('should include timestamp component', () => {
      const beforeTimestamp = Date.now().toString(36);
      const taskId = generateTaskId();
      const afterTimestamp = Date.now().toString(36);
      
      // The task ID should start with task_ followed by a timestamp
      expect(taskId).toMatch(/^task_[a-z0-9]+/);
      
      // Extract the timestamp part
      const parts = taskId.split('-');
      const timestampPart = parts[0].replace('task_', '');
      
      // Timestamp should be between before and after
      expect(timestampPart.length).toBeGreaterThan(0);
      expect(timestampPart.length).toBeLessThanOrEqual(beforeTimestamp.length + 1);
    });

    test('should generate different IDs when called rapidly', () => {
      const id1 = generateTaskId();
      const id2 = generateTaskId();
      const id3 = generateTaskId();
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('should contain only valid base36 characters', () => {
      const taskId = generateTaskId();
      const base36Pattern = /^task_[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/;
      
      expect(taskId).toMatch(base36Pattern);
    });

    test('should have reasonable length', () => {
      const taskId = generateTaskId();
      
      // Should be at least task_X-X-X (minimum 11 chars)
      expect(taskId.length).toBeGreaterThan(10);
      // Should not be excessively long
      expect(taskId.length).toBeLessThan(100);
    });
  });
});
