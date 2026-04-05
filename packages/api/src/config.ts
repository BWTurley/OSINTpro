import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),

  // PostgreSQL
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/osint'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: z.string().default(''),
  ELASTICSEARCH_PASSWORD: z.string().default(''),

  // Neo4j
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USERNAME: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('neo4j'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('osint-files'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  // JWT
  JWT_SECRET: z.string().default('change-me-in-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().default('change-me-refresh-in-production'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/auth/google/callback'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32).default('a]3Fk9$mPq!Lx7Nw@2Rv&Yz^Jb8Ht5Ue'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Frontend
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Log level
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error('Invalid environment configuration:', formatted);
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }
  return result.data;
}

export const config = loadConfig();

if (config.NODE_ENV === 'production') {
  const errors: string[] = [];
  if (config.JWT_SECRET.includes('change-me')) errors.push('JWT_SECRET must be changed for production');
  if (config.JWT_REFRESH_SECRET.includes('change-me')) errors.push('JWT_REFRESH_SECRET must be changed for production');
  if (config.ENCRYPTION_KEY === 'a]3Fk9$mPq!Lx7Nw@2Rv&Yz^Jb8Ht5Ue') errors.push('ENCRYPTION_KEY must be changed for production');
  if (config.MINIO_ACCESS_KEY === 'minioadmin') errors.push('MINIO_ACCESS_KEY must be changed for production');
  if (config.MINIO_SECRET_KEY === 'minioadmin') errors.push('MINIO_SECRET_KEY must be changed for production');
  if (errors.length > 0) {
    throw new Error(`Production configuration errors:\n${errors.join('\n')}`);
  }
}
