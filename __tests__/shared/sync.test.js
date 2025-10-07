import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock storage functions
const mockPutTextBlob = jest.fn();
const mockDeleteBlob = jest.fn();
const mockListBlobs = jest.fn();
const mockGetTextBlob = jest.fn();

jest.unstable_mockModule('../../shared/storage.js', () => ({
  putTextBlob: mockPutTextBlob,
  deleteBlob: mockDeleteBlob,
  list: mockListBlobs,
  getTextBlob: mockGetTextBlob
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

describe('sync.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(); // Reset fetch mock for each test
  });

  describe('fullSync', () => {
    test('should sync all markdown files from GitHub', async () => {
      // Mock GitHub API response for listing files, then file content fetches
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([
            { type: 'file', name: '0001.md' },
            { type: 'file', name: '0002.md' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 1 content').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 2 content').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);

      const result = await fullSync('main', false);

      expect(result.changed).toBe(2);
      expect(result.mode).toBe('full');
      expect(result.scope).toBe('tasks');
      expect(mockPutTextBlob).toHaveBeenCalledTimes(4); // 2 tasks + lastHeadSha + nextId
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'raw/tasks/0001.md',
        'Task 1 content',
        'text/markdown'
      );
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'raw/tasks/0002.md',
        'Task 2 content',
        'text/markdown'
      );
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/lastHeadSha.txt',
        'main',
        'text/plain'
      );
    });

    test('should extract and update nextId from filenames', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { type: 'file', name: '0005.md' },
          { type: 'file', name: '0008.md' },
          { type: 'file', name: '0003.md' }
        ])
      });

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 5').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 8').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 3').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);

      const result = await fullSync('main', false);

      expect(result.nextId).toBe(9); // Max ID (8) + 1
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/nextId.txt',
        '9',
        'text/plain'
      );
    });

    test('should clean up removed files when clean=true', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { type: 'file', name: '0001.md' }
        ])
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task 1').toString('base64')
        })
      });

      mockListBlobs.mockResolvedValue([
        'raw/tasks/0001.md',
        'raw/tasks/0002.md', // This one should be deleted
        'raw/tasks/0003.md'  // This one should be deleted
      ]);

      mockPutTextBlob.mockResolvedValue(undefined);
      mockDeleteBlob.mockResolvedValue(undefined);

      const result = await fullSync('main', true);

      expect(result.removed).toBe(2);
      expect(mockDeleteBlob).toHaveBeenCalledWith('raw/tasks/0002.md');
      expect(mockDeleteBlob).toHaveBeenCalledWith('raw/tasks/0003.md');
    });
  });

  describe('applyDiff', () => {
    test('should add and modify files', async () => {
      const paths = {
        addedOrModified: [
          'codex-miroir/tasks/0001.md',
          'codex-miroir/tasks/0002.md'
        ],
        removed: []
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 1 modified').toString('base64')
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from('Task 2 new').toString('base64')
          })
        });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5'); // Current nextId

      const result = await applyDiff(paths, 'abc123');

      expect(result.changed).toBe(2);
      expect(result.deleted).toBe(0);
      expect(result.mode).toBe('diff');
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'raw/tasks/0001.md',
        'Task 1 modified',
        'text/markdown'
      );
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/lastHeadSha.txt',
        'abc123',
        'text/plain'
      );
    });

    test('should remove deleted files', async () => {
      const paths = {
        addedOrModified: [],
        removed: [
          'codex-miroir/tasks/0003.md',
          'codex-miroir/tasks/0004.md'
        ]
      };

      mockDeleteBlob.mockResolvedValue(undefined);
      mockPutTextBlob.mockResolvedValue(undefined);

      const result = await applyDiff(paths, 'abc123');

      expect(result.deleted).toBe(2);
      expect(result.changed).toBe(0);
      expect(mockDeleteBlob).toHaveBeenCalledWith('raw/tasks/0003.md');
      expect(mockDeleteBlob).toHaveBeenCalledWith('raw/tasks/0004.md');
    });

    test('should skip non-markdown files', async () => {
      const paths = {
        addedOrModified: [
          'codex-miroir/tasks/0001.md',
          'codex-miroir/tasks/README.txt'
        ],
        removed: [
          'codex-miroir/tasks/config.json'
        ]
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
      mockDeleteBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5');

      const result = await applyDiff(paths, 'abc123');

      expect(result.changed).toBe(1);
      expect(result.deleted).toBe(0);
      expect(result.skipped).toBe(2);
    });

    test('should update nextId to maximum of current and new IDs', async () => {
      const paths = {
        addedOrModified: [
          'codex-miroir/tasks/0010.md'
        ],
        removed: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('Task 10').toString('base64')
        })
      });

      mockPutTextBlob.mockResolvedValue(undefined);
      mockGetTextBlob.mockResolvedValue('5'); // Current nextId

      const result = await applyDiff(paths, 'abc123');

      expect(result.nextId).toBe(11); // max(5, 10) + 1
      expect(mockPutTextBlob).toHaveBeenCalledWith(
        'state/nextId.txt',
        '11',
        'text/plain'
      );
    });
  });
});
