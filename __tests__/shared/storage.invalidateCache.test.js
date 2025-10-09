import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock Azure Blob Storage
const mockUpload = jest.fn();
const mockDeleteIfExists = jest.fn();
const mockExists = jest.fn();
const mockDownload = jest.fn();
const mockListBlobsFlat = jest.fn();
const mockCreateIfNotExists = jest.fn();

const mockGetBlockBlobClient = jest.fn(() => ({
  upload: mockUpload,
  deleteIfExists: mockDeleteIfExists
}));

const mockGetBlobClient = jest.fn(() => ({
  exists: mockExists,
  download: mockDownload
}));

const mockGetContainerClient = jest.fn(() => ({
  createIfNotExists: mockCreateIfNotExists,
  getBlockBlobClient: mockGetBlockBlobClient,
  getBlobClient: mockGetBlobClient,
  listBlobsFlat: mockListBlobsFlat
}));

jest.unstable_mockModule('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn(() => ({
      getContainerClient: mockGetContainerClient
    }))
  }
}));

// Set up environment
process.env.AZURE_BLOB_CONN = 'test-connection-string';
process.env.AZURE_BLOB_CONTAINER = 'test-container';

const { invalidateCache, putTextBlob, getTextBlob } = await import('../../shared/storage.js');

describe('storage.js - invalidateCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateIfNotExists.mockResolvedValue(undefined);
    mockUpload.mockResolvedValue(undefined);
    mockDeleteIfExists.mockResolvedValue(undefined);
    mockExists.mockResolvedValue(true);
  });

  test('should generate new timestamp-based cacheVersion', async () => {
    // Mock list to return existing caches
    mockListBlobsFlat.mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield { name: 'artifacts/timeline_12345.json' };
        yield { name: 'artifacts/timeline_67890.json' };
      }
    }));

    const beforeTimestamp = Date.now();
    const result = await invalidateCache();
    const afterTimestamp = Date.now();

    // Check that cacheVersion was set
    expect(mockUpload).toHaveBeenCalled();
    
    // Find the upload call for cacheVersion.txt
    const cacheVersionCall = mockUpload.mock.calls.find(call => {
      // Check if getBlockBlobClient was called with 'state/cacheVersion.txt'
      const blockBlobCalls = mockGetBlockBlobClient.mock.calls;
      return blockBlobCalls.some(c => c[0] === 'state/cacheVersion.txt');
    });

    expect(cacheVersionCall).toBeDefined();
    expect(result.cacheVersion).toBeDefined();
    
    // Verify timestamp is within expected range
    const timestamp = parseInt(result.cacheVersion, 10);
    expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
  });

  test('should delete all timeline caches', async () => {
    // Mock list to return existing caches
    mockListBlobsFlat.mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield { name: 'artifacts/timeline_12345.json' };
        yield { name: 'artifacts/timeline_67890.json' };
        yield { name: 'artifacts/timeline_abcde.json' };
      }
    }));

    const result = await invalidateCache();

    // Should have deleted all 3 caches
    expect(result.cacheCleared).toBe(3);
    expect(mockDeleteIfExists).toHaveBeenCalledTimes(3);
  });

  test('should handle no existing caches', async () => {
    // Mock list to return no caches
    mockListBlobsFlat.mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () {
        // No items
      }
    }));

    const result = await invalidateCache();

    // Should have cleared 0 caches
    expect(result.cacheCleared).toBe(0);
    expect(mockDeleteIfExists).not.toHaveBeenCalled();
  });

  test('should return cacheVersion and cacheCleared count', async () => {
    mockListBlobsFlat.mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield { name: 'artifacts/timeline_1.json' };
      }
    }));

    const result = await invalidateCache();

    expect(result).toHaveProperty('cacheVersion');
    expect(result).toHaveProperty('cacheCleared');
    expect(typeof result.cacheVersion).toBe('string');
    expect(typeof result.cacheCleared).toBe('number');
    expect(result.cacheCleared).toBe(1);
  });
});
