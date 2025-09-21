import { randomBytes } from 'crypto';
import { storage } from '../storage';
import type { CreateTokenRequest, AccessToken } from '@shared/schema';

export class TokenService {
  /**
   * Generate a cryptographically secure random token
   */
  static generateSecureToken(): string {
    return randomBytes(32).toString('hex'); // 64 character hex string
  }

  /**
   * Create a new access token
   */
  static async createToken(request: CreateTokenRequest): Promise<AccessToken> {
    const token = this.generateSecureToken();
    const expiresAt = request.expiresInDays 
      ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return await storage.createAccessToken({
      token,
      permission: request.permission,
      mode: request.mode,
      expiresAt,
    });
  }

  /**
   * Validate token and check permissions
   */
  static async validateToken(
    token: string,
    requiredPermission: 'read' | 'write',
    requiredMode: 'professional' | 'private'
  ): Promise<{ valid: boolean; accessToken?: AccessToken }> {
    if (!token) {
      return { valid: false };
    }

    const accessToken = await storage.getAccessToken(token);
    if (!accessToken) {
      return { valid: false };
    }

    // Check if token is expired
    if (accessToken.expiresAt && new Date() > accessToken.expiresAt) {
      return { valid: false };
    }

    // Check mode permission
    if (accessToken.mode !== requiredMode) {
      return { valid: false };
    }

    // Check operation permission (write tokens can also read)
    if (requiredPermission === 'write' && accessToken.permission !== 'write') {
      return { valid: false };
    }

    // Update last used timestamp
    await storage.updateTokenLastUsed(token);

    return { valid: true, accessToken };
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    return await storage.deleteExpiredTokens();
  }

  /**
   * Generate secure access URL
   */
  static generateAccessURL(token: string, baseURL: string = ''): string {
    return `${baseURL}/?token=${token}`;
  }
}