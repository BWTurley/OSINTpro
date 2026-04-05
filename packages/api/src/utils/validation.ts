import { z } from 'zod';

export const entityTypeEnum = z.enum([
  'PERSON',
  'ORGANIZATION',
  'DOMAIN',
  'IP_ADDRESS',
  'EMAIL',
  'PHONE',
  'CRYPTOCURRENCY',
  'SOCIAL_MEDIA',
  'VEHICLE',
  'LOCATION',
]);

export const tlpLevelEnum = z.enum(['WHITE', 'GREEN', 'AMBER', 'AMBER_STRICT', 'RED']);
export const roleEnum = z.enum(['ADMIN', 'ANALYST', 'VIEWER', 'API_USER']);
export const caseStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED']);

export const createEntitySchema = z.object({
  entityType: entityTypeEnum,
  data: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).default(0),
  admiraltySource: z.string().optional(),
  admiraltyCredibility: z.string().optional(),
  tlpLevel: tlpLevelEnum.default('WHITE'),
  tags: z.array(z.string()).default([]),
  sources: z.array(z.record(z.unknown())).default([]),
});

export const updateEntitySchema = z.object({
  data: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  admiraltySource: z.string().optional(),
  admiraltyCredibility: z.string().optional(),
  tlpLevel: tlpLevelEnum.optional(),
  tags: z.array(z.string()).optional(),
  sources: z.array(z.record(z.unknown())).optional(),
});

export const createRelationshipSchema = z.object({
  sourceEntityId: z.string().uuid(),
  sourceEntityType: z.string(),
  targetEntityId: z.string().uuid(),
  targetEntityType: z.string(),
  relationshipType: z.string(),
  confidence: z.number().min(0).max(1).default(0),
  admiraltySource: z.string().optional(),
  admiraltyCredibility: z.string().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateRelationshipSchema = z.object({
  relationshipType: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  admiraltySource: z.string().optional(),
  admiraltyCredibility: z.string().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const createCaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: caseStatusEnum.default('OPEN'),
  tlpLevel: tlpLevelEnum.default('WHITE'),
  tags: z.array(z.string()).default([]),
});

export const updateCaseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: caseStatusEnum.optional(),
  tlpLevel: tlpLevelEnum.optional(),
  tags: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
});

export const searchSchema = z.object({
  query: z.string().min(1),
  entityTypes: z.array(entityTypeEnum).optional(),
  tlpLevels: z.array(tlpLevelEnum).optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().min(0).default(0),
  size: z.number().int().min(1).max(100).default(25),
});

export const triggerCollectionSchema = z.object({
  entityId: z.string().uuid(),
  modules: z.array(z.string()).min(1),
});

export const bulkImportSchema = z.object({
  entities: z.array(createEntitySchema).min(1).max(1000),
});

export const createNoteSchema = z.object({
  entityId: z.string().uuid(),
  caseId: z.string().uuid().optional(),
  content: z.string().min(1),
  classification: z.string().optional(),
});

export const moduleConfigSchema = z.object({
  moduleName: z.string().min(1),
  apiKey: z.string().min(1),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

export const createScheduledJobSchema = z.object({
  name: z.string().min(1),
  cronExpression: z.string().min(1),
  moduleNames: z.array(z.string()).min(1),
  entityFilter: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipInput = z.infer<typeof updateRelationshipSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type TriggerCollectionInput = z.infer<typeof triggerCollectionSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type ModuleConfigInput = z.infer<typeof moduleConfigSchema>;
export type CreateScheduledJobInput = z.infer<typeof createScheduledJobSchema>;
