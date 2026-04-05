import { gql } from '@apollo/client';
import { ENTITY_FIELDS } from '../queries/entities';

export const CREATE_ENTITY = gql`
  ${ENTITY_FIELDS}
  mutation CreateEntity($input: CreateEntityInput!) {
    createEntity(input: $input) {
      ...EntityFields
    }
  }
`;

export const UPDATE_ENTITY = gql`
  ${ENTITY_FIELDS}
  mutation UpdateEntity($id: ID!, $input: UpdateEntityInput!) {
    updateEntity(id: $id, input: $input) {
      ...EntityFields
    }
  }
`;

export const MERGE_ENTITIES = gql`
  ${ENTITY_FIELDS}
  mutation MergeEntities($sourceIds: [ID!]!, $targetId: ID!) {
    mergeEntities(sourceIds: $sourceIds, targetId: $targetId) {
      ...EntityFields
    }
  }
`;

export const DELETE_ENTITY = gql`
  mutation DeleteEntity($id: ID!) {
    deleteEntity(id: $id) {
      success
      message
    }
  }
`;
