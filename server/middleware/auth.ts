import type { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/token';
import { storage } from '../storage';

interface AuthenticatedRequest extends Request {
  auth?: {
    token: string;
    permission: 'read' | 'write';
    mode: 'professional' | 'private';
  };
}

/**
 * Authentication middleware that validates bearer tokens
 */
export function requireAuth(requiredPermission: 'read' | 'write') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header or query parameter
      let token: string | undefined;
      
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.query.token && typeof req.query.token === 'string') {
        token = req.query.token;
      }

      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required', 
          message: 'Provide token via Authorization: Bearer <token> header or ?token= query parameter' 
        });
      }

      // Extract mode from route parameters, body, or task lookup
      let mode = req.params.mode as 'professional' | 'private' | undefined;
      
      if (!mode && req.body?.mode) {
        mode = req.body.mode;
      }
      
      if (!mode && req.params.id) {
        // For routes with task ID, lookup the task to get its mode
        const task = await storage.getTaskById(req.params.id);
        if (task) {
          mode = task.mode as 'professional' | 'private';
        }
      }
      
      if (!mode || (mode !== 'professional' && mode !== 'private')) {
        return res.status(400).json({ 
          error: 'Invalid mode', 
          message: 'Mode must be professional or private, provided via :mode param, body.mode, or derived from task ID' 
        });
      }

      // Validate token
      const validation = await TokenService.validateToken(token, requiredPermission, mode);
      if (!validation.valid || !validation.accessToken) {
        return res.status(403).json({ 
          error: 'Invalid or insufficient permissions', 
          message: `Token must have ${requiredPermission} permission for ${mode} mode` 
        });
      }

      // Add auth info to request
      req.auth = {
        token,
        permission: validation.accessToken.permission as 'read' | 'write',
        mode: validation.accessToken.mode as 'professional' | 'private',
      };

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

/**
 * Middleware to require admin API key for token management
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'];
  const expectedAdminKey = process.env.ADMIN_API_KEY;

  if (!expectedAdminKey) {
    return res.status(500).json({ 
      error: 'Admin API not configured', 
      message: 'ADMIN_API_KEY environment variable not set' 
    });
  }

  if (!adminKey || adminKey !== expectedAdminKey) {
    return res.status(401).json({ 
      error: 'Admin authentication required',
      message: 'Provide X-Admin-Key header with valid admin key'
    });
  }

  next();
}