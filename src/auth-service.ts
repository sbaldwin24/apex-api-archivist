/**
 * Authentication Service
 * Handles JWT token generation, validation, and user authentication
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { StructuredLogger } from './structured-logger';
import type { Request, Response, NextFunction } from 'express';

const logger = new StructuredLogger('auth-service');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Ensure JWT_SECRET is never undefined
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Password hashing rounds
const BCRYPT_ROUNDS = 12;

/**
 * User tiers for API access control
 */
export enum UserTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin'
}

/**
 * User interface for authentication
 */
export interface User {
  id: string;
  email: string;
  tier: UserTier;
  apiKey?: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

/**
 * JWT Payload interface
 */
export interface JWTPayload {
  userId: string;
  email: string;
  tier: UserTier;
  iat?: number;
  exp?: number;
}

/**
 * Authentication result interface
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  message?: string;
}

/**
 * Rate limiting configuration by user tier
 */
export const RATE_LIMITS = {
  [UserTier.FREE]: { requests: 100, window: 3600 }, // 100 requests per hour
  [UserTier.PRO]: { requests: 1000, window: 3600 }, // 1000 requests per hour
  [UserTier.ENTERPRISE]: { requests: 10000, window: 3600 }, // 10k requests per hour
  [UserTier.ADMIN]: { requests: 50000, window: 3600 }, // 50k requests per hour
} as const;

/**
 * Authentication Service Class
 */
export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      logger.debug('Password hashed successfully', 'auth-service');
      return hashedPassword;
    } catch (error) {
      logger.error('Password hashing failed', 'auth-service', {
        error: (error as Error).message
      });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hashedPassword);
      logger.debug('Password verification completed', 'auth-service', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Password verification failed', 'auth-service', {
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload: JWTPayload, expiresIn: string = JWT_EXPIRES_IN): string {
    try {
      const options: any = {
        expiresIn: expiresIn || JWT_EXPIRES_IN,
        issuer: 'nascar-api',
        audience: 'nascar-api-users'
      };
      const token = jwt.sign(payload, JWT_SECRET as string, options);
      
      logger.info('JWT token generated', 'auth-service', { 
        userId: payload.userId,
        tier: payload.tier
      });
      
      return token;
    } catch (error) {
      logger.error('JWT token generation failed', 'auth-service', {
        error: (error as Error).message
      });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: JWTPayload): string {
    return AuthService.generateToken(payload, JWT_REFRESH_EXPIRES_IN);
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET as string, {
        issuer: 'nascar-api',
        audience: 'nascar-api-users'
      }) as JWTPayload;
      
      logger.debug('JWT token verified successfully', 'auth-service', {
        userId: decoded.userId
      });
      
      return decoded;
    } catch (error) {
      logger.warn('JWT token verification failed', 'auth-service', {
        error: (error as Error).message,
        tokenPrefix: token.substring(0, 20) + '...'
      });
      return null;
    }
  }

  /**
   * Generate API key for a user
   */
  static generateApiKey(userId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const userHash = Buffer.from(userId).toString('base64').substring(0, 8);
    
    return `nascar_${timestamp}${random}${userHash}`.replace(/[+/=]/g, '');
  }

  /**
   * Validate API key format
   */
  static isValidApiKeyFormat(apiKey: string): boolean {
    const apiKeyPattern = /^nascar_[a-zA-Z0-9]{20,40}$/;
    return apiKeyPattern.test(apiKey);
  }

  /**
   * Extract user ID from API key (if possible)
   */
  static extractUserIdFromApiKey(apiKey: string): string | null {
    try {
      if (!AuthService.isValidApiKeyFormat(apiKey)) {
        return null;
      }
      
      // Extract the user hash part and decode it
      const parts = apiKey.replace('nascar_', '');
      const userHash = parts.substring(parts.length - 8);
      const userId = Buffer.from(userHash, 'base64').toString();
      
      return userId || null;
    } catch (error) {
      logger.debug('Failed to extract user ID from API key', 'auth-service');
      return null;
    }
  }

  /**
   * Check if user has required tier access
   */
  static hasRequiredTier(userTier: UserTier, requiredTier: UserTier): boolean {
    const tierHierarchy = {
      [UserTier.FREE]: 0,
      [UserTier.PRO]: 1,
      [UserTier.ENTERPRISE]: 2,
      [UserTier.ADMIN]: 3
    };

    return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
  }

  /**
   * Get rate limit for user tier
   */
  static getRateLimitForTier(tier: UserTier) {
    return RATE_LIMITS[tier] || RATE_LIMITS[UserTier.FREE];
  }
}

/**
 * Express middleware for JWT authentication
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ 
      error: 'Access token required',
      code: 'MISSING_TOKEN'
    });
    return;
  }

  const decoded = AuthService.verifyToken(token);
  if (!decoded) {
    res.status(401).json({ 
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
    return;
  }

  // Add user info to request
  (req as any).user = decoded;
  next();
};

/**
 * Express middleware for API key authentication
 */
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ 
      error: 'API key required',
      code: 'MISSING_API_KEY'
    });
    return;
  }

  if (!AuthService.isValidApiKeyFormat(apiKey)) {
    res.status(401).json({ 
      error: 'Invalid API key format',
      code: 'INVALID_API_KEY_FORMAT'
    });
    return;
  }

  // In a real application, you would lookup the API key in the database
  // For now, we'll extract basic info from the key structure
  const userId = AuthService.extractUserIdFromApiKey(apiKey);
  
  if (!userId) {
    res.status(401).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
    return;
  }

  // Mock user lookup - replace with actual database lookup
  const mockUser: User = {
    id: userId,
    email: 'user@example.com',
    tier: UserTier.FREE, // Default tier
    apiKey,
    isActive: true,
    createdAt: new Date(),
  };

  // Add user info to request
  (req as any).user = mockUser;
  (req as any).authType = 'api-key';
  
  next();
};

/**
 * Express middleware for flexible authentication (JWT or API key)
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Try JWT first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }

  // Try API key
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  // No authentication provided
  res.status(401).json({ 
    error: 'Authentication required. Provide either Bearer token or API key.',
    code: 'AUTHENTICATION_REQUIRED'
  });
};

/**
 * Authorization middleware factory for tier-based access control
 */
export const requireTier = (requiredTier: UserTier) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      });
      return;
    }

    if (!AuthService.hasRequiredTier(user.tier, requiredTier)) {
      res.status(403).json({ 
        error: `Access denied. Required tier: ${requiredTier}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        userTier: user.tier,
        requiredTier
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to add user context to requests
 */
export const addUserContext = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  
  if (user) {
    // Add user context to logger
    logger.info('User context added to request', 'auth', {
      userId: user.id,
      userTier: user.tier,
      authType: (req as any).authType || 'jwt'
    });
  }
  
  next();
};

// Export configured middleware
export const requireAuth = authenticate;
export const requireAdmin = [authenticate, requireTier(UserTier.ADMIN)];
export const requirePro = [authenticate, requireTier(UserTier.PRO)];
export const requireEnterprise = [authenticate, requireTier(UserTier.ENTERPRISE)];
