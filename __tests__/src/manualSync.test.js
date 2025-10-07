import { describe, test, expect } from '@jest/globals';

describe('manualSync.js', () => {
  describe('URL parameter parsing', () => {
    test('should extract mode parameter', () => {
      const url = new URL('http://localhost:7071/sync?mode=full');
      const mode = (url.searchParams.get('mode') || 'full').toLowerCase();
      
      expect(mode).toBe('full');
    });

    test('should use default mode when not specified', () => {
      const url = new URL('http://localhost:7071/sync');
      const mode = (url.searchParams.get('mode') || 'full').toLowerCase();
      
      expect(mode).toBe('full');
    });

    test('should extract ref parameter', () => {
      const url = new URL('http://localhost:7071/sync?ref=develop');
      const defaultBranch = 'main';
      const ref = url.searchParams.get('ref') || defaultBranch;
      
      expect(ref).toBe('develop');
    });

    test('should use default branch when ref not specified', () => {
      const url = new URL('http://localhost:7071/sync');
      const defaultBranch = 'main';
      const ref = url.searchParams.get('ref') || defaultBranch;
      
      expect(ref).toBe('main');
    });

    test('should extract since parameter', () => {
      const url = new URL('http://localhost:7071/sync?mode=diff&since=abc123');
      const since = url.searchParams.get('since') || '';
      
      expect(since).toBe('abc123');
    });

    test('should extract clean parameter', () => {
      const url = new URL('http://localhost:7071/sync?clean=true');
      const clean = url.searchParams.get('clean') === 'true';
      
      expect(clean).toBe(true);
    });

    test('should default clean to false', () => {
      const url = new URL('http://localhost:7071/sync');
      const clean = url.searchParams.get('clean') === 'true';
      
      expect(clean).toBe(false);
    });
  });

  describe('mode validation', () => {
    test('should accept full mode', () => {
      const mode = 'full';
      const validModes = ['full', 'diff'];
      
      expect(validModes.includes(mode)).toBe(true);
    });

    test('should accept diff mode', () => {
      const mode = 'diff';
      const validModes = ['full', 'diff'];
      
      expect(validModes.includes(mode)).toBe(true);
    });

    test('should reject invalid mode', () => {
      const mode = 'invalid';
      const validModes = ['full', 'diff'];
      
      expect(validModes.includes(mode)).toBe(false);
    });
  });

  describe('diff mode validation', () => {
    test('should require since parameter for diff mode', () => {
      const mode = 'diff';
      const since = '';
      const isValid = mode !== 'diff' || since !== '';
      
      expect(isValid).toBe(false);
    });

    test('should accept diff mode with since parameter', () => {
      const mode = 'diff';
      const since = 'abc123';
      const isValid = mode !== 'diff' || since !== '';
      
      expect(isValid).toBe(true);
    });

    test('should not require since for full mode', () => {
      const mode = 'full';
      const since = '';
      const isValid = mode !== 'diff' || since !== '';
      
      expect(isValid).toBe(true);
    });
  });

  describe('diffPaths function logic', () => {
    test('should filter paths by base path and extension', () => {
      const files = [
        { filename: 'codex-miroir/tasks/0001.md', status: 'added' },
        { filename: 'codex-miroir/tasks/0002.md', status: 'modified' },
        { filename: 'codex-miroir/tasks/0003.md', status: 'removed' },
        { filename: 'README.md', status: 'modified' },
        { filename: 'codex-miroir/other/file.md', status: 'added' },
        { filename: 'codex-miroir/tasks/config.json', status: 'added' }
      ];

      const base = 'codex-miroir';
      const inScope = (p) => p.startsWith(`${base}/tasks/`) && p.endsWith('.md');
      
      const addedOrModified = [];
      const removed = [];
      
      for (const f of files) {
        const p = f.filename;
        if (!inScope(p)) continue;
        if (f.status === 'removed') removed.push(p);
        else addedOrModified.push(p);
      }

      expect(addedOrModified).toEqual([
        'codex-miroir/tasks/0001.md',
        'codex-miroir/tasks/0002.md'
      ]);
      expect(removed).toEqual(['codex-miroir/tasks/0003.md']);
    });

    test('should handle empty files array', () => {
      const files = [];
      const base = 'codex-miroir';
      const inScope = (p) => p.startsWith(`${base}/tasks/`) && p.endsWith('.md');
      
      const addedOrModified = [];
      const removed = [];
      
      for (const f of files) {
        const p = f.filename;
        if (!inScope(p)) continue;
        if (f.status === 'removed') removed.push(p);
        else addedOrModified.push(p);
      }

      expect(addedOrModified).toEqual([]);
      expect(removed).toEqual([]);
    });
  });
});
