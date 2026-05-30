/**
 * Request schema validation middleware using Zod.
 *
 * Usage:
 *   router.post('/deposits', validate({ body: DepositSchema }), handler)
 *
 * Validates req.body, req.query, and/or req.params against the provided schemas.
 * Strips unknown fields from req.body when a body schema is provided (strict mode).
 * Returns a uniform 400 response on failure.
 */

import { z, ZodError, ZodTypeAny } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// ─── Shared field schemas ─────────────────────────────────────────────────────

/** Stellar wallet address: G + 55 base32 chars, uppercase */
export const walletAddressSchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar wallet address format');

/** Positive numeric amount (accepts number or numeric string) */
export const amountSchema = z
  .union([z.number(), z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number')])
  .transform((v) => Number(v))
  .refine((v) => v > 0, 'Amount must be greater than 0')
  .refine((v) => isFinite(v), 'Amount must be a finite number');

// ─── Body schemas ─────────────────────────────────────────────────────────────

/** POST /api/v1/vault/deposits  and  POST /api/v1/vault/withdrawals */
export const VaultOperationSchema = z
  .object({
    amount: amountSchema,
    asset: z.string().min(1).max(12),
    walletAddress: walletAddressSchema,
    email: z.string().email().optional(),
    referralCode: z.string().max(64).optional(),
  })
  .strict();

/** POST /api/v1/auth/login */
export const LoginSchema = z
  .object({
    walletAddress: walletAddressSchema,
  })
  .strict();

/** POST /api/v1/auth/refresh */
export const RefreshSchema = z
  .object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  })
  .strict();

// ─── Middleware factory ───────────────────────────────────────────────────────

interface ValidateTargets {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

function toValidationCode(issueCode: string): string {
  switch (issueCode) {
    case 'invalid_type':
      return 'VAL_INVALID_TYPE';
    case 'invalid_string':
      return 'VAL_INVALID_STRING';
    case 'too_small':
      return 'VAL_TOO_SMALL';
    case 'too_big':
      return 'VAL_TOO_BIG';
    case 'unrecognized_keys':
      return 'VAL_UNRECOGNIZED_KEYS';
    case 'custom':
      return 'VAL_CUSTOM';
    default:
      return `VAL_${issueCode.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
  }
}

function formatZodError(err: ZodError): string {
  return err.errors
    .map((e) => `${e.path.length ? e.path.join('.') + ': ' : ''}${e.message}`)
    .join('; ');
}

function buildValidationDetails(err: ZodError): ValidationErrorDetail[] {
  const details = err.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: toValidationCode(issue.code),
  }));

  return details.sort((a, b) => {
    if (a.field !== b.field) {
      return a.field.localeCompare(b.field);
    }
    if (a.code !== b.code) {
      return a.code.localeCompare(b.code);
    }
    return a.message.localeCompare(b.message);
  });
}

export function validate(schemas: ValidateTargets) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = buildValidationDetails(err);
        res.status(400).json({
          error: 'Bad Request',
          status: 400,
          code: 'VALIDATION_ERROR',
          summary: 'Request validation failed',
          errors: details,
          message: formatZodError(err),
          details,
        });
        return;
      }
      next(err);
    }
  };
}

// Re-export z for convenience in tests
export { z };
