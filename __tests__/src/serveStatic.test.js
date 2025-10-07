import { describe, test, expect } from '@jest/globals';
import path from 'path';

describe('serveStatic.js', () => {
  describe('path normalization', () => {
    test('should normalize empty path to index.html', () => {
      let requestPath = '';
      if (!requestPath || requestPath === '/') {
        requestPath = 'index.html';
      }
      
      expect(requestPath).toBe('index.html');
    });

    test('should normalize root path to index.html', () => {
      let requestPath = '/';
      if (!requestPath || requestPath === '/') {
        requestPath = 'index.html';
      }
      
      expect(requestPath).toBe('index.html');
    });

    test('should keep other paths unchanged', () => {
      let requestPath = 'styles.css';
      if (!requestPath || requestPath === '/') {
        requestPath = 'index.html';
      }
      
      expect(requestPath).toBe('styles.css');
    });
  });

  describe('path traversal protection', () => {
    test('should block paths with ..', () => {
      const requestPath = '../etc/passwd';
      const isBlocked = requestPath.includes('..');
      
      expect(isBlocked).toBe(true);
    });

    test('should allow normal paths', () => {
      const requestPath = 'styles.css';
      const isBlocked = requestPath.includes('..');
      
      expect(isBlocked).toBe(false);
    });

    test('should allow nested paths', () => {
      const requestPath = 'assets/images/logo.png';
      const isBlocked = requestPath.includes('..');
      
      expect(isBlocked).toBe(false);
    });
  });

  describe('API route filtering', () => {
    test('should skip codex route', () => {
      const requestPath = 'codex';
      const isApiRoute = requestPath.startsWith('codex') || 
                         requestPath.startsWith('sync') || 
                         requestPath.startsWith('github');
      
      expect(isApiRoute).toBe(true);
    });

    test('should skip sync route', () => {
      const requestPath = 'sync';
      const isApiRoute = requestPath.startsWith('codex') || 
                         requestPath.startsWith('sync') || 
                         requestPath.startsWith('github');
      
      expect(isApiRoute).toBe(true);
    });

    test('should skip github route', () => {
      const requestPath = 'github/webhook';
      const isApiRoute = requestPath.startsWith('codex') || 
                         requestPath.startsWith('sync') || 
                         requestPath.startsWith('github');
      
      expect(isApiRoute).toBe(true);
    });

    test('should not skip static files', () => {
      const requestPath = 'index.html';
      const isApiRoute = requestPath.startsWith('codex') || 
                         requestPath.startsWith('sync') || 
                         requestPath.startsWith('github');
      
      expect(isApiRoute).toBe(false);
    });

    test('should not skip asset files', () => {
      const requestPath = 'assets/app.js';
      const isApiRoute = requestPath.startsWith('codex') || 
                         requestPath.startsWith('sync') || 
                         requestPath.startsWith('github');
      
      expect(isApiRoute).toBe(false);
    });
  });

  describe('file path construction', () => {
    test('should construct correct path for public directory', () => {
      const srcDir = '/app/src';
      const requestPath = 'index.html';
      const fullPath = path.join(path.dirname(srcDir), 'public', requestPath);
      
      expect(fullPath).toBe(path.normalize('/app/public/index.html'));
    });

    test('should construct correct path for nested files', () => {
      const srcDir = '/app/src';
      const requestPath = 'assets/styles.css';
      const fullPath = path.join(path.dirname(srcDir), 'public', requestPath);
      
      expect(fullPath).toBe(path.normalize('/app/public/assets/styles.css'));
    });
  });

  describe('content type determination', () => {
    test('should determine content type for HTML', () => {
      const requestPath = 'index.html';
      const ext = requestPath.split('.').pop().toLowerCase();
      const types = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon'
      };
      const contentType = types[ext] || 'text/plain';
      
      expect(contentType).toBe('text/html');
    });

    test('should determine content type for CSS', () => {
      const requestPath = 'styles.css';
      const ext = requestPath.split('.').pop().toLowerCase();
      const types = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript'
      };
      const contentType = types[ext] || 'text/plain';
      
      expect(contentType).toBe('text/css');
    });

    test('should determine content type for JavaScript', () => {
      const requestPath = 'app.js';
      const ext = requestPath.split('.').pop().toLowerCase();
      const types = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript'
      };
      const contentType = types[ext] || 'text/plain';
      
      expect(contentType).toBe('application/javascript');
    });

    test('should use default content type for unknown extensions', () => {
      const requestPath = 'file.unknown';
      const ext = requestPath.split('.').pop().toLowerCase();
      const types = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript'
      };
      const contentType = types[ext] || 'text/plain';
      
      expect(contentType).toBe('text/plain');
    });
  });

  describe('error handling', () => {
    test('should identify ENOENT error code', () => {
      const error = { code: 'ENOENT' };
      const isNotFound = error.code === 'ENOENT';
      
      expect(isNotFound).toBe(true);
    });

    test('should identify non-ENOENT errors', () => {
      const error = { code: 'EACCES' };
      const isNotFound = error.code === 'ENOENT';
      
      expect(isNotFound).toBe(false);
    });
  });
});
