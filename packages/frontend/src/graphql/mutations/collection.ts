import { gql } from '@apollo/client';

export const TRIGGER_COLLECTION = gql`
  mutation TriggerCollection($entityId: ID!, $modules: [String!]) {
    triggerCollection(entityId: $entityId, modules: $modules) {
      jobs {
        id
        module
        entityId
        status
        createdAt
      }
      count
    }
  }
`;

export const BULK_IMPORT = gql`
  mutation BulkImport($input: BulkImportInput!) {
    bulkImport(input: $input) {
      created
      updated
      errors {
        value
        message
      }
      entities {
        id
        type
        value
        label
      }
    }
  }
`;
