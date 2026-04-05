import { typeDefs } from './typeDefs.js';
import { entityResolvers } from '../resolvers/entityResolvers.js';
import { relationshipResolvers } from '../resolvers/relationshipResolvers.js';
import { caseResolvers } from '../resolvers/caseResolvers.js';
import { collectionResolvers } from '../resolvers/collectionResolvers.js';
import { searchResolvers } from '../resolvers/searchResolvers.js';
import { adminResolvers } from '../resolvers/adminResolvers.js';

// Merge all resolvers into a single object
function mergeResolvers(
  ...resolverSets: Array<Record<string, Record<string, unknown>>>
): Record<string, Record<string, unknown>> {
  const merged: Record<string, Record<string, unknown>> = {};

  for (const resolvers of resolverSets) {
    for (const [typeName, typeResolvers] of Object.entries(resolvers)) {
      if (!merged[typeName]) {
        merged[typeName] = {};
      }
      Object.assign(merged[typeName], typeResolvers);
    }
  }

  return merged;
}

// JSON and DateTime scalar resolvers
const scalarResolvers = {
  JSON: {
    __serialize: (value: unknown) => value,
    __parseValue: (value: unknown) => value,
    __parseLiteral: (ast: { kind: string; value: string }) => {
      if (ast.kind === 'StringValue') {
        try {
          return JSON.parse(ast.value);
        } catch {
          return ast.value;
        }
      }
      return ast.value;
    },
  },
  DateTime: {
    __serialize: (value: unknown) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    },
    __parseValue: (value: unknown) => {
      if (typeof value === 'string') return new Date(value);
      return value;
    },
    __parseLiteral: (ast: { kind: string; value: string }) => {
      if (ast.kind === 'StringValue') return new Date(ast.value);
      return null;
    },
  },
};

export const resolvers = mergeResolvers(
  scalarResolvers,
  entityResolvers,
  relationshipResolvers,
  caseResolvers,
  collectionResolvers,
  searchResolvers,
  adminResolvers,
);

export { typeDefs };
