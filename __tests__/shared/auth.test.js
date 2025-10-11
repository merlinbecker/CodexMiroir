import { describe, it, expect, jest } from '@jest/globals';
import { extractUserId, validateAuth } from '../../shared/auth.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('OAuth2 Authentication', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractUserId', () => {
    it('should extract userId from valid Bearer token', async () => {
      // Mock GitHub API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' })
      });

      const mockRequest = {
        headers: {
          get: (name) => name === 'authorization' ? 'Bearer test_token_123' : null
        }
      };

      const userId = await extractUserId(mockRequest);
      
      expect(userId).toBe('testuser');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_token_123'
          })
        })
      );
    });

    it('should extract userId from session cookie when Authorization header is missing', async () => {
      // Mock GitHub API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'cookieuser' })
      });

      const mockRequest = {
        headers: {
          get: (name) => {
            if (name === 'authorization') return null;
            if (name === 'cookie') return 'session=cookie_token_456; other=value';
            return null;
          }
        }
      };

      const userId = await extractUserId(mockRequest);
      
      expect(userId).toBe('cookieuser');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer cookie_token_456'
          })
        })
      );
    });

    it('should prioritize Authorization header over session cookie', async () => {
      // Mock GitHub API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'headeruser' })
      });

      const mockRequest = {
        headers: {
          get: (name) => {
            if (name === 'authorization') return 'Bearer header_token';
            if (name === 'cookie') return 'session=cookie_token; other=value';
            return null;
          }
        }
      };

      const userId = await extractUserId(mockRequest);
      
      expect(userId).toBe('headeruser');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer header_token'
          })
        })
      );
    });

    it('should throw error when both Authorization header and session cookie are missing', async () => {
      const mockRequest = {
        headers: {
          get: () => null
        }
      };

      await expect(extractUserId(mockRequest)).rejects.toThrow('Missing token (Authorization header or session cookie)');
    });

    it('should throw error when Authorization header has invalid format but no cookie', async () => {
      const mockRequest = {
        headers: {
          get: (name) => {
            if (name === 'authorization') return 'Invalid token';
            return null;
          }
        }
      };

      await expect(extractUserId(mockRequest)).rejects.toThrow('Missing token (Authorization header or session cookie)');
    });

    it('should throw error when GitHub API returns error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      const mockRequest = {
        headers: {
          get: (name) => name === 'authorization' ? 'Bearer invalid_token' : null
        }
      };

      await expect(extractUserId(mockRequest)).rejects.toThrow('GitHub API error: 401');
    });

    it('should throw error when GitHub API returns invalid user data', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123 }) // Missing login field
      });

      const mockRequest = {
        headers: {
          get: (name) => name === 'authorization' ? 'Bearer test_token' : null
        }
      };

      await expect(extractUserId(mockRequest)).rejects.toThrow('Invalid user data from GitHub API');
    });
  });

  describe('validateAuth', () => {
    it('should return userId and no error for valid token', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'validuser' })
      });

      const mockRequest = {
        headers: {
          get: (name) => name === 'authorization' ? 'Bearer valid_token' : null
        }
      };

      const result = await validateAuth(mockRequest);

      expect(result.userId).toBe('validuser');
      expect(result.error).toBeNull();
    });

    it('should return error object for invalid token', async () => {
      const mockRequest = {
        headers: {
          get: () => null
        }
      };

      const result = await validateAuth(mockRequest);

      expect(result.userId).toBeNull();
      expect(result.error).toEqual({
        status: 401,
        jsonBody: {
          ok: false,
          error: 'Missing token (Authorization header or session cookie)'
        }
      });
    });

    it('should return error object when GitHub API fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Rate limit exceeded'
      });

      const mockRequest = {
        headers: {
          get: (name) => name === 'authorization' ? 'Bearer test_token' : null
        }
      };

      const result = await validateAuth(mockRequest);

      expect(result.userId).toBeNull();
      expect(result.error).toEqual({
        status: 401,
        jsonBody: {
          ok: false,
          error: expect.stringContaining('GitHub API error: 403')
        }
      });
    });
  });
});
