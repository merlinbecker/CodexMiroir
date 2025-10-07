import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock Azure Blob Storage
const mockUpload = jest.fn();
const mockDownload = jest.fn();
const mockExists = jest.fn();
const mockDeleteIfExists = jest.fn();
const mockListBlobsFlat = jest.fn();
const mockCreateIfNotExists = jest.fn();

const mockBlockBlobClient = {
  upload: mockUpload,
  download: mockDownload,
  exists: mockExists,
  deleteIfExists: mockDeleteIfExists
};

const mockBlobClient = {
  exists: mockExists,
  download: mockDownload
};

const mockContainerClient = {
  getBlockBlobClient: jest.fn(() => mockBlockBlobClient),
  getBlobClient: jest.fn(() => mockBlobClient),
  listBlobsFlat: mockListBlobsFlat,
  createIfNotExists: mockCreateIfNotExists
};

const mockBlobServiceClient = {
  getContainerClient: jest.fn(() => mockContainerClient)
};

jest.unstable_mockModule('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn(() => mockBlobServiceClient)
  }
}));

// Set up environment
process.env.AZURE_BLOB_CONN = 'mock-connection-string';
process.env.AZURE_BLOB_CONTAINER = 'test-container';

const { putTextBlob, putBufferBlob, getTextBlob, deleteBlob, list } = await import('../../shared/storage.js');

describe('storage.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateIfNotExists.mockResolvedValue(undefined);
  });

  describe('putTextBlob', () => {
    test('should upload text as blob', async () => {
      mockUpload.mockResolvedValue(undefined);

      await putTextBlob('test/path.md', 'Hello World', 'text/markdown');

      expect(mockContainerClient.createIfNotExists).toHaveBeenCalled();
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('test/path.md');
      expect(mockUpload).toHaveBeenCalled();
      
      const [data, length, options] = mockUpload.mock.calls[0];
      expect(Buffer.from(data).toString('utf8')).toBe('Hello World');
      expect(options.blobHTTPHeaders.blobContentType).toBe('text/markdown');
    });

    test('should use default content type', async () => {
      mockUpload.mockResolvedValue(undefined);

      await putTextBlob('test/path.txt', 'Test');

      const [, , options] = mockUpload.mock.calls[0];
      expect(options.blobHTTPHeaders.blobContentType).toBe('text/markdown');
    });
  });

  describe('putBufferBlob', () => {
    test('should upload buffer as blob', async () => {
      mockUpload.mockResolvedValue(undefined);
      const buffer = Buffer.from('Binary data');

      await putBufferBlob('test/binary.bin', buffer, 'application/octet-stream');

      expect(mockUpload).toHaveBeenCalled();
      const [data, length, options] = mockUpload.mock.calls[0];
      expect(data).toBe(buffer);
      expect(length).toBe(buffer.length);
      expect(options.blobHTTPHeaders.blobContentType).toBe('application/octet-stream');
    });
  });

  describe('getTextBlob', () => {
    test('should download and return text blob', async () => {
      mockExists.mockResolvedValue(true);
      
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('Hello ');
          yield Buffer.from('World');
        }
      };
      
      mockDownload.mockResolvedValue({
        readableStreamBody: mockStream
      });

      const result = await getTextBlob('test/path.txt');

      expect(result).toBe('Hello World');
      expect(mockBlobClient.exists).toHaveBeenCalled();
    });

    test('should return null if blob does not exist', async () => {
      mockExists.mockResolvedValue(false);

      const result = await getTextBlob('nonexistent/path.txt');

      expect(result).toBeNull();
      expect(mockDownload).not.toHaveBeenCalled();
    });

    test('should handle stream chunks as Uint8Array', async () => {
      mockExists.mockResolvedValue(true);
      
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([72, 105]); // "Hi"
        }
      };
      
      mockDownload.mockResolvedValue({
        readableStreamBody: mockStream
      });

      const result = await getTextBlob('test/path.txt');

      expect(result).toBe('Hi');
    });
  });

  describe('deleteBlob', () => {
    test('should delete blob', async () => {
      mockDeleteIfExists.mockResolvedValue(undefined);

      await deleteBlob('test/path.txt');

      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('test/path.txt');
      expect(mockDeleteIfExists).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    test('should list blobs with prefix', async () => {
      const mockBlobs = [
        { name: 'raw/tasks/0001.md' },
        { name: 'raw/tasks/0002.md' },
        { name: 'raw/tasks/0003.md' }
      ];

      mockListBlobsFlat.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const blob of mockBlobs) {
            yield blob;
          }
        }
      });

      const result = await list('raw/tasks/');

      expect(result).toEqual([
        'raw/tasks/0001.md',
        'raw/tasks/0002.md',
        'raw/tasks/0003.md'
      ]);
      expect(mockListBlobsFlat).toHaveBeenCalledWith({ prefix: 'raw/tasks/' });
    });

    test('should return empty array when no blobs found', async () => {
      mockListBlobsFlat.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          // No items
        }
      });

      const result = await list('empty/');

      expect(result).toEqual([]);
    });
  });
});
