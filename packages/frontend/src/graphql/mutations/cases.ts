import { gql } from '@apollo/client';
import { CASE_FIELDS } from '../queries/cases';

export const CREATE_CASE = gql`
  ${CASE_FIELDS}
  mutation CreateCase($input: CreateCaseInput!) {
    createCase(input: $input) {
      ...CaseFields
    }
  }
`;

export const UPDATE_CASE = gql`
  ${CASE_FIELDS}
  mutation UpdateCase($id: ID!, $input: UpdateCaseInput!) {
    updateCase(id: $id, input: $input) {
      ...CaseFields
    }
  }
`;

export const ADD_ENTITY_TO_CASE = gql`
  mutation AddEntityToCase($caseId: ID!, $entityId: ID!) {
    addEntityToCase(caseId: $caseId, entityId: $entityId) {
      success
      message
    }
  }
`;

export const REMOVE_ENTITY_FROM_CASE = gql`
  mutation RemoveEntityFromCase($caseId: ID!, $entityId: ID!) {
    removeEntityFromCase(caseId: $caseId, entityId: $entityId) {
      success
      message
    }
  }
`;

export const ADD_NOTE = gql`
  mutation AddNote($caseId: ID!, $input: AddNoteInput!) {
    addNote(caseId: $caseId, input: $input) {
      id
      content
      author
      tlp
      createdAt
      updatedAt
    }
  }
`;
