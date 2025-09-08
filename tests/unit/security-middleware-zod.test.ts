import { validationSchemas, validateSchema } from '../../src/security-middleware';
import { Request, Response, NextFunction } from 'express';

describe('Security Middleware - Zod Migration', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      path: '/test'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('validationSchemas', () => {
    it('should validate API key with correct format', () => {
      const validApiKey = 'nascar_abcdef1234567890abcdef12';
      const result = validationSchemas.apiKey.safeParse(validApiKey);
      expect(result.success).toBe(true);
    });

    it('should reject invalid API key format', () => {
      const invalidApiKey = 'invalid_key';
      const result = validationSchemas.apiKey.safeParse(invalidApiKey);
      expect(result.success).toBe(false);
    });

    it('should validate car number format', () => {
      const validCarNumber = '24A';
      const result = validationSchemas.carNumber.safeParse(validCarNumber);
      expect(result.success).toBe(true);
    });

    it('should validate email format', () => {
      const validEmail = 'test@example.com';
      const result = validationSchemas.email.safeParse(validEmail);
      expect(result.success).toBe(true);
    });

    it('should validate password complexity', () => {
      const validPassword = 'StrongPass123!';
      const result = validationSchemas.password.safeParse(validPassword);
      expect(result.success).toBe(true);
    });

    it('should reject weak password', () => {
      const weakPassword = 'weak';
      const result = validationSchemas.password.safeParse(weakPassword);
      expect(result.success).toBe(false);
    });

    it('should validate year range', () => {
      const validYear = 2024;
      const result = validationSchemas.year.safeParse(validYear);
      expect(result.success).toBe(true);
    });

    it('should reject invalid year', () => {
      const invalidYear = 1900;
      const result = validationSchemas.year.safeParse(invalidYear);
      expect(result.success).toBe(false);
    });
  });

  describe('validateSchema middleware', () => {
    it('should pass validation with valid data', () => {
      const schema = validationSchemas.email;
      const middleware = validateSchema(schema, 'body');

      mockReq.body = 'test@example.com';

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid data', () => {
      const schema = validationSchemas.email;
      const middleware = validateSchema(schema, 'body');

      mockReq.body = 'invalid-email';

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          error: 'Validation failed'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate query parameters', () => {
      const schema = validationSchemas.year;
      const middleware = validateSchema(schema, 'query');

      mockReq.query = 2024 as any;

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should provide detailed error messages', () => {
      const schema = validationSchemas.password;
      const middleware = validateSchema(schema, 'body');

      mockReq.body = 'weak';

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
              type: expect.any(String)
            })
          ])
        })
      );
    });
  });

  describe('Zod vs Joi behavior parity', () => {
    it('should handle missing required fields similarly', () => {
      const schema = validationSchemas.email;
      const result = schema.safeParse(undefined);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error?.issues?.[0]?.code).toBe('invalid_type');
      }
    });

    it('should handle type coercion appropriately', () => {
      const schema = validationSchemas.year;
      
      // Should accept number
      expect(schema.safeParse(2024).success).toBe(true);
      
      // Should reject string that looks like number (no automatic coercion)
      expect(schema.safeParse('2024').success).toBe(false);
    });

    it('should provide structured error information', () => {
      const schema = validationSchemas.apiKey;
      const result = schema.safeParse('invalid');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue).toHaveProperty('code');
        expect(issue).toHaveProperty('message');
        expect(issue).toHaveProperty('path');
      }
    });
  });
});
