import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock Azure Blob Storage for ID management
const mockAcquireLease = jest.fn();
const mockReleaseLease = jest.fn();
const mockUpload = jest.fn();
const mockDownload = jest.fn();
const mockCreateIfNotExists = jest.fn();

const mockLeaseClient = {
  acquireLease: mockAcquireLease,
  releaseLease: mockReleaseLease
};

const mockBlobClient = {
  getBlobLeaseClient: jest.fn(() => mockLeaseClient),
  upload: mockUpload,
  download: mockDownload
};

const mockContainerClient = {
  getBlockBlobClient: jest.fn(() => mockBlobClient),
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

const { withIdLock } = await import('../../shared/id.js');

describe('id.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateIfNotExists.mockResolvedValue(undefined);
  });

  describe('withIdLock', () => {
    test('should acquire lock, read ID, increment and return formatted ID', async () => {
      const mockLeaseId = 'mock-lease-id';
      mockAcquireLease.mockResolvedValue({ leaseId: mockLeaseId });
      
      // Mock the download to return "5" as current ID
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('5');
        }
      };
      mockDownload.mockResolvedValue({
        readableStreamBody: mockStream
      });
      
      mockUpload.mockResolvedValue(undefined);
      mockReleaseLease.mockResolvedValue(undefined);

      const result = await withIdLock();

      expect(result).toBe('0005');
      expect(mockAcquireLease).toHaveBeenCalledWith(15);
      expect(mockDownload).toHaveBeenCalledWith(0, undefined, { 
        conditions: { leaseId: mockLeaseId } 
      });
      expect(mockUpload).toHaveBeenCalled();
      
      // Verify the uploaded value is incremented
      const [uploadedBuffer] = mockUpload.mock.calls[0];
      expect(Buffer.from(uploadedBuffer).toString('utf8')).toBe('6');
      
      expect(mockReleaseLease).toHaveBeenCalled();
    });

    test('should create blob with initial value if not exists (404)', async () => {
      const mockLeaseId = 'mock-lease-id';
      
      // First acquireLease fails with 404
      mockAcquireLease
        .mockRejectedValueOnce({ statusCode: 404 })
        .mockResolvedValueOnce({ leaseId: mockLeaseId });
      
      mockUpload.mockResolvedValue(undefined);
      
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('0');
        }
      };
      mockDownload.mockResolvedValue({
        readableStreamBody: mockStream
      });
      
      mockReleaseLease.mockResolvedValue(undefined);

      const result = await withIdLock();

      expect(result).toBe('0000');
      expect(mockUpload).toHaveBeenCalledTimes(2); // Once to create, once to increment
      expect(mockReleaseLease).toHaveBeenCalled();
    });

    test('should handle empty/invalid current value as 0', async () => {
      const mockLeaseId = 'mock-lease-id';
      mockAcquireLease.mockResolvedValue({ leaseId: mockLeaseId });
      
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('  '); // Empty/whitespace
        }
      };
      mockDownload.mockResolvedValue({
        readableStreamBody: mockStream
      });
      
      mockUpload.mockResolvedValue(undefined);
      mockReleaseLease.mockResolvedValue(undefined);

      const result = await withIdLock();

      expect(result).toBe('0000');
      
      const [uploadedBuffer] = mockUpload.mock.calls[0];
      expect(Buffer.from(uploadedBuffer).toString('utf8')).toBe('1');
    });

    test('should pad ID to 4 digits', async () => {
      const mockLeaseId = 'mock-lease-id';
      mockAcquireLease.mockResolvedValue({ leaseId: mockLeaseId });
      
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('123');
        }
      };
      mockDownload.mockResolvedValue({
        readableStreamBody: mockStream
      });
      
      mockUpload.mockResolvedValue(undefined);
      mockReleaseLease.mockResolvedValue(undefined);

      const result = await withIdLock();

      expect(result).toBe('0123');
    });

    test('should release lease even if upload fails', async () => {
      const mockLeaseId = 'mock-lease-id';
      mockAcquireLease.mockResolvedValue({ leaseId: mockLeaseId });
      
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('5');
        }
      };
      mockDownload.mockResolvedValue({
        readableStreamBody: mockStream
      });
      
      mockUpload.mockRejectedValue(new Error('Upload failed'));
      mockReleaseLease.mockResolvedValue(undefined);

      await expect(withIdLock()).rejects.toThrow('Upload failed');
      
      expect(mockReleaseLease).toHaveBeenCalled();
    });
  });
});
