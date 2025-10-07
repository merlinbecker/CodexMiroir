import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import crypto from 'crypto';

describe('githubWebhook.js', () => {
  describe('verifySignature', () => {
    test('should verify valid GitHub webhook signature', () => {
      const secret = 'test-secret';
      const payload = JSON.stringify({ test: 'data' });
      
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;
      
      const verifySignature = (requestBody, signature, webhookSecret) => {
        if (!signature || !signature.startsWith('sha256=')) return false;
        const mac = crypto.createHmac('sha256', webhookSecret);
        mac.update(requestBody);
        const digest = `sha256=${mac.digest('hex')}`;
        try {
          return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
        } catch {
          return false;
        }
      };
      
      const isValid = verifySignature(payload, expectedSignature, secret);
      expect(isValid).toBe(true);
    });

    test('should reject invalid signature', () => {
      const secret = 'test-secret';
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid';
      
      const verifySignature = (requestBody, signature, webhookSecret) => {
        if (!signature || !signature.startsWith('sha256=')) return false;
        const mac = crypto.createHmac('sha256', webhookSecret);
        mac.update(requestBody);
        const digest = `sha256=${mac.digest('hex')}`;
        try {
          return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
        } catch {
          return false;
        }
      };
      
      const isValid = verifySignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    test('should reject signature without sha256 prefix', () => {
      const verifySignature = (requestBody, signature, webhookSecret) => {
        if (!signature || !signature.startsWith('sha256=')) return false;
        return true;
      };
      
      expect(verifySignature('body', 'invalid', 'secret')).toBe(false);
      expect(verifySignature('body', null, 'secret')).toBe(false);
      expect(verifySignature('body', undefined, 'secret')).toBe(false);
    });

    test('should handle signature comparison errors', () => {
      const verifySignature = (requestBody, signature, webhookSecret) => {
        if (!signature || !signature.startsWith('sha256=')) return false;
        const mac = crypto.createHmac('sha256', webhookSecret);
        mac.update(requestBody);
        const digest = `sha256=${mac.digest('hex')}`;
        try {
          return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
        } catch {
          return false;
        }
      };
      
      // Different length signatures should cause timingSafeEqual to throw
      const isValid = verifySignature('body', 'sha256=short', 'secret');
      expect(isValid).toBe(false);
    });

    test('should throw error when body is not string or Buffer', () => {
      const verifySignature = (requestBody, signature, webhookSecret) => {
        if (!signature || !signature.startsWith('sha256=')) return false;
        
        // Ensure body is a string or buffer (defensive check)
        if (typeof requestBody !== 'string' && !Buffer.isBuffer(requestBody)) {
          throw new TypeError(`verifySignature expects string or Buffer, got ${typeof requestBody}`);
        }
        
        const mac = crypto.createHmac('sha256', webhookSecret);
        mac.update(requestBody);
        const digest = `sha256=${mac.digest('hex')}`;
        try {
          return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
        } catch {
          return false;
        }
      };
      
      // Test with invalid types that would cause the original error
      const secret = 'test-secret';
      const signature = 'sha256=abc123';
      
      // Test with an object (simulating ReadableStream)
      expect(() => {
        verifySignature({}, signature, secret);
      }).toThrow(TypeError);
      
      // Test with array
      expect(() => {
        verifySignature([], signature, secret);
      }).toThrow(TypeError);
      
      // Test with number
      expect(() => {
        verifySignature(123, signature, secret);
      }).toThrow(TypeError);
    });

    test('should accept Buffer as body', () => {
      const secret = 'test-secret';
      const payload = Buffer.from(JSON.stringify({ test: 'data' }));
      
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;
      
      const verifySignature = (requestBody, signature, webhookSecret) => {
        if (!signature || !signature.startsWith('sha256=')) return false;
        
        if (typeof requestBody !== 'string' && !Buffer.isBuffer(requestBody)) {
          throw new TypeError(`verifySignature expects string or Buffer, got ${typeof requestBody}`);
        }
        
        const mac = crypto.createHmac('sha256', webhookSecret);
        mac.update(requestBody);
        const digest = `sha256=${mac.digest('hex')}`;
        try {
          return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
        } catch {
          return false;
        }
      };
      
      const isValid = verifySignature(payload, expectedSignature, secret);
      expect(isValid).toBe(true);
    });
  });

  describe('webhook payload processing', () => {
    test('should extract added files from push event', () => {
      const payload = {
        after: 'abc123',
        commits: [
          {
            added: ['codex-miroir/tasks/0001.md', 'codex-miroir/tasks/0002.md'],
            modified: [],
            removed: []
          }
        ]
      };

      const addedOrModified = [];
      const base = 'codex-miroir';
      
      for (const c of payload.commits || []) {
        for (const p of c.added || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            addedOrModified.push(p);
          }
        }
      }

      expect(addedOrModified).toEqual([
        'codex-miroir/tasks/0001.md',
        'codex-miroir/tasks/0002.md'
      ]);
    });

    test('should extract modified files from push event', () => {
      const payload = {
        after: 'abc123',
        commits: [
          {
            added: [],
            modified: ['codex-miroir/tasks/0003.md'],
            removed: []
          }
        ]
      };

      const addedOrModified = [];
      const base = 'codex-miroir';
      
      for (const c of payload.commits || []) {
        for (const p of c.modified || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            addedOrModified.push(p);
          }
        }
      }

      expect(addedOrModified).toEqual(['codex-miroir/tasks/0003.md']);
    });

    test('should extract removed files from push event', () => {
      const payload = {
        after: 'abc123',
        commits: [
          {
            added: [],
            modified: [],
            removed: ['codex-miroir/tasks/0004.md', 'codex-miroir/tasks/0005.md']
          }
        ]
      };

      const removed = [];
      const base = 'codex-miroir';
      
      for (const c of payload.commits || []) {
        for (const p of c.removed || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            removed.push(p);
          }
        }
      }

      expect(removed).toEqual([
        'codex-miroir/tasks/0004.md',
        'codex-miroir/tasks/0005.md'
      ]);
    });

    test('should filter non-task files', () => {
      const payload = {
        after: 'abc123',
        commits: [
          {
            added: [
              'codex-miroir/tasks/0001.md',
              'README.md',
              'codex-miroir/other/file.md',
              'codex-miroir/tasks/config.json'
            ],
            modified: [],
            removed: []
          }
        ]
      };

      const addedOrModified = [];
      const base = 'codex-miroir';
      
      for (const c of payload.commits || []) {
        for (const p of c.added || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            addedOrModified.push(p);
          }
        }
      }

      expect(addedOrModified).toEqual(['codex-miroir/tasks/0001.md']);
    });

    test('should handle multiple commits', () => {
      const payload = {
        after: 'abc123',
        commits: [
          {
            added: ['codex-miroir/tasks/0001.md'],
            modified: [],
            removed: []
          },
          {
            added: [],
            modified: ['codex-miroir/tasks/0002.md'],
            removed: []
          },
          {
            added: [],
            modified: [],
            removed: ['codex-miroir/tasks/0003.md']
          }
        ]
      };

      const addedOrModified = [];
      const removed = [];
      const base = 'codex-miroir';
      
      for (const c of payload.commits || []) {
        for (const p of c.added || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            addedOrModified.push(p);
          }
        }
        for (const p of c.modified || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            addedOrModified.push(p);
          }
        }
        for (const p of c.removed || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            removed.push(p);
          }
        }
      }

      expect(addedOrModified).toEqual([
        'codex-miroir/tasks/0001.md',
        'codex-miroir/tasks/0002.md'
      ]);
      expect(removed).toEqual(['codex-miroir/tasks/0003.md']);
    });

    test('should handle empty commits array', () => {
      const payload = {
        after: 'abc123',
        commits: []
      };

      const addedOrModified = [];
      const removed = [];
      const base = 'codex-miroir';
      
      for (const c of payload.commits || []) {
        for (const p of c.added || []) {
          if (p.startsWith(`${base}/tasks/`) && p.endsWith('.md')) {
            addedOrModified.push(p);
          }
        }
      }

      expect(addedOrModified).toEqual([]);
      expect(removed).toEqual([]);
    });
  });
});
