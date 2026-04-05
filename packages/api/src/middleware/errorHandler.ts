import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function createAppError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: unknown,
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appErr = err as AppError;

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  const statusCode = appErr.statusCode ?? 500;
  const code = appErr.code ?? 'INTERNAL_ERROR';

  // Log server errors
  if (statusCode >= 500) {
    logger.error(
      {
        err,
        method: req.method,
        path: req.path,
        statusCode,
      },
      'Unhandled server error',
    );
  } else {
    logger.warn(
      {
        method: req.method,
        path: req.path,
        statusCode,
        message: err.message,
      },
      'Client error',
    );
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    code,
    ...(appErr.details && statusCode < 500 ? { details: appErr.details } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
}
