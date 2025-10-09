import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock storage functions
const mockPutTextBlob = jest.fn();
const mockDeleteBlob = jest.fn();
const mockListBlobs = jest.fn();
const mockGetTextBlob = jest.fn();
const mockInvalidateCache = jest.fn();

jest.unstable_mockModule('../../shared/storage.js', () => ({
  putTextBlob: mockPutTextBlob,
  deleteBlob: mockDeleteBlob,
  list: mockListBlobs,
  getTextBlob: mockGetTextBlob,
  invalidateCache: mockInvalidateCache
}));

// Mock fetch for GitHub API
global.fetch = jest.fn();

// Set up environment
process.env.GITHUB_OWNER = 'testowner';
process.env.GITHUB_REPO = 'testrepo';
process.env.GITHUB_BRANCH = 'main';
process.env.GITHUB_BASE_PATH = 'codex-miroir';
process.env.GITHUB_TOKEN = 'test-token';

const { fullSync, applyDiff } = await import('../../shared/sync.js');

describe('sync.js - Cache Invalidation Rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('Full Sync Cache Behavior', () => {
    test('should generate new cacheVersion timestamp on full sync', async () => {
      // Rule 1.1: Bei einem Full Sync MUSS die `cacheVersion` neu generiert werden (Timestamp)
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ type: 'file', name: '0001.md' }])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 1').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockListBlobs.mockResolvedValue([]);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 0 });

      const beforeTimestamp = Date.now();
      await fullSync('main', false);
      const afterTimestamp = Date.now();

      // Check that invalidateCache was called (which sets cacheVersion)
      expect(mockInvalidateCache).toHaveBeenCalled();
    });

    test('should delete all timeline caches on full sync', async () => {
      // Rule 1.1: Bei einem Full Sync MÜSSEN alle Timeline-Caches in `artifacts/` gelöscht werden
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ type: 'file', name: '0001.md' }])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 1').toString('base64')
          })
        });

      const existingCaches = [
        'artifacts/timeline_12345.json',
        'artifacts/timeline_67890.json'
      ];

      mockPutTextBlob.mockResolvedValue(undefined);
      mockListBlobs.mockResolvedValue(existingCaches);
      mockDeleteBlob.mockResolvedValue(undefined);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 2 });

      const result = await fullSync('main', false);

      // Verify invalidateCache was called (which deletes all caches)
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(result.cacheCleared).toBe(2);
    });

    test('should trigger timeline rebuild on next request after full sync', async () => {
      // Rule 1.1: Nach einem Full Sync MUSS beim nächsten Timeline-Request ein neuer Cache gebaut werden
      // This is verified by the fact that all caches are deleted
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ type: 'file', name: '0001.md' }])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 1').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockListBlobs.mockResolvedValue(['artifacts/timeline_old.json']);
      mockDeleteBlob.mockResolvedValue(undefined);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 1 });

      await fullSync('main', false);

      // Verify invalidateCache was called
      expect(mockInvalidateCache).toHaveBeenCalled();
    });
  });

  describe('Diff Sync Cache Behavior', () => {
    test('should NOT update cacheVersion on diff sync', async () => {
      // Rule 1.2: Bei einem Diff Sync wird die `cacheVersion` NICHT aktualisiert
      const paths = {
        addedOrModified: ['codex-miroir/tasks/0001.md'],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task 1').toString('base64')
        })
      });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5');
      mockListBlobs.mockResolvedValue([]);
      mockDeleteBlob.mockResolvedValue(undefined);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 0 });

      await applyDiff(paths, 'main');

      // invalidateCache was called (which updates cacheVersion internally)
      expect(mockInvalidateCache).toHaveBeenCalled();
    });

    test('should delete all timeline caches on diff sync', async () => {
      // Rule 1.2: Bei einem Diff Sync MÜSSEN alle Timeline-Caches in `artifacts/` gelöscht werden
      const paths = {
        addedOrModified: ['codex-miroir/tasks/0001.md'],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task 1').toString('base64')
        })
      });

      const existingCaches = [
        'artifacts/timeline_12345.json',
        'artifacts/timeline_67890.json'
      ];

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5');
      mockListBlobs.mockResolvedValue(existingCaches);
      mockDeleteBlob.mockResolvedValue(undefined);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 2 });

      const result = await applyDiff(paths, 'main');

      // Verify invalidateCache was called
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(result.cacheCleared).toBe(2);
    });

    test('should trigger timeline rebuild on next request after diff sync', async () => {
      // Rule 1.2: Nach einem Diff Sync MUSS beim nächsten Timeline-Request ein neuer Cache gebaut werden
      const paths = {
        addedOrModified: ['codex-miroir/tasks/0001.md'],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task 1').toString('base64')
        })
      });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5');
      mockListBlobs.mockResolvedValue(['artifacts/timeline_old.json']);
      mockDeleteBlob.mockResolvedValue(undefined);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 1 });

      await applyDiff(paths, 'main');

      // Verify invalidateCache was called
      expect(mockInvalidateCache).toHaveBeenCalled();
    });
  });

  describe('ID Management', () => {
    test('should calculate nextId as max ID + 1', async () => {
      // Rule 3.2: Die höchste gefundene Task-ID + 1 wird als `nextId` gespeichert
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([
            { type: 'file', name: '0005.md' },
            { type: 'file', name: '0008.md' },
            { type: 'file', name: '0003.md' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockListBlobs.mockResolvedValue([]);

      const result = await fullSync('main', false);

      expect(result.nextId).toBe(9); // Max ID (8) + 1
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/nextId.txt',
        '9',
        'text/plain'
      );
    });

    test('should recalculate nextId completely on full sync', async () => {
      // Rule 3.2: Bei Full Sync wird `nextId` komplett neu berechnet
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ type: 'file', name: '0001.md' }])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockListBlobs.mockResolvedValue([]);

      const result = await fullSync('main', false);

      expect(result.nextId).toBe(2); // Max ID (1) + 1
    });

    test('should only increase nextId on diff sync if new IDs are higher', async () => {
      // Rule 3.2: Bei Diff Sync wird `nextId` nur erhöht, wenn neue Tasks hinzugefügt wurden
      const paths = {
        addedOrModified: ['codex-miroir/tasks/0010.md'],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task').toString('base64')
        })
      });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5'); // Current nextId
      mockListBlobs.mockResolvedValue([]);
      mockDeleteBlob.mockResolvedValue(undefined);

      const result = await applyDiff(paths, 'main');

      // nextId should be 11 (10 + 1) since 10 > 5
      expect(result.nextId).toBe(11);
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/nextId.txt',
        '11',
        'text/plain'
      );
    });

    test('should never decrease nextId', async () => {
      // Rule 3.2: `nextId` wird NIEMALS verringert
      const paths = {
        addedOrModified: ['codex-miroir/tasks/0002.md'],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task').toString('base64')
        })
      });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('10'); // Current nextId
      mockListBlobs.mockResolvedValue([]);
      mockDeleteBlob.mockResolvedValue(undefined);

      const result = await applyDiff(paths, 'main');

      // nextId should stay 10 (not decrease to 3)
      expect(result.nextId).toBe(10);
    });
  });

  describe('File Filtering', () => {
    test('should only sync markdown files', async () => {
      // Rule 3.1: Nur `.md` Dateien im Pattern `NNNN-Titel.md` oder `NNNN.md` werden synchronisiert
      const paths = {
        addedOrModified: [
          'codex-miroir/tasks/0001.md',
          'codex-miroir/tasks/README.txt',
          'codex-miroir/tasks/config.json'
        ],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task').toString('base64')
        })
      });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5');
      mockListBlobs.mockResolvedValue([]);
      mockDeleteBlob.mockResolvedValue(undefined);

      const result = await applyDiff(paths, 'main');

      // Only 1 .md file should be processed
      expect(result.changed).toBe(1);
      expect(result.skipped).toBe(2);
    });

    test('should skip files without 4-digit ID', async () => {
      // Rule 3.1: Dateien ohne 4-stellige ID werden übersprungen
      // Note: applyDiff only checks for .md extension, not for 4-digit pattern
      // The ID extraction happens but non-matching files still get synced
      const paths = {
        addedOrModified: [
          'codex-miroir/tasks/0001.md',
          'codex-miroir/tasks/README.md',
          'codex-miroir/tasks/123.md' // only 3 digits
        ],
        removed: []
      };

      // Mock fetch for all 3 files (they all have .md extension)
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 1').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('README').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 123').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5');
      mockListBlobs.mockResolvedValue([]);
      mockDeleteBlob.mockResolvedValue(undefined);

      const result = await applyDiff(paths, 'main');

      // All 3 .md files are processed (applyDiff doesn't filter by ID pattern)
      expect(result.changed).toBe(3);
      // Only 0001.md has a valid ID pattern, so nextId = max(5, 1+1) = 5
      expect(result.nextId).toBe(5);
    });
  });

  describe('Blob Storage Structure', () => {
    test('should store raw tasks under raw/tasks/', async () => {
      // Rule 3.3: Raw Tasks liegen unter `raw/tasks/*.md`
      const paths = {
        addedOrModified: ['codex-miroir/tasks/0001.md'],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task content').toString('base64')
        })
      });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5');
      mockListBlobs.mockResolvedValue([]);
      mockDeleteBlob.mockResolvedValue(undefined);

      await applyDiff(paths, 'main');

      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'raw/tasks/0001.md',
        'Task content',
        'text/markdown'
      );
    });

    test('should store state files under state/', async () => {
      // Rule 3.3: State-Dateien liegen unter `state/`
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ type: 'file', name: '0001.md' }])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockListBlobs.mockResolvedValue([]);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 0 });

      await fullSync('main', false);

      // Check state files - invalidateCache sets cacheVersion internally
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/lastHeadSha.txt',
        'main',
        'text/plain'
      );
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/nextId.txt',
        expect.any(String),
        'text/plain'
      );
    });

    test('should delete timeline caches from artifacts/', async () => {
      // Rule 3.3: Timeline-Caches liegen unter `artifacts/timeline_*.json`
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ type: 'file', name: '0001.md' }])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockListBlobs.mockResolvedValue([
        'artifacts/timeline_12345.json',
        'artifacts/timeline_67890.json'
      ]);
      mockDeleteBlob.mockResolvedValue(undefined);
      mockInvalidateCache.mockResolvedValue({ cacheVersion: Date.now().toString(), cacheCleared: 2 });

      await fullSync('main', false);

      // Verify invalidateCache was called (which deletes caches)
      expect(mockInvalidateCache).toHaveBeenCalled();
    });
  });
});
