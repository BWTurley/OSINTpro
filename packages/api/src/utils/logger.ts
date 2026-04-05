import pino from 'pino';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'osint-api' },
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export function generateTraceId(): string {
  return randomUUID();
}

export type Logger = pino.Logger;
