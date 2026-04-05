import { gql } from '@apollo/client';
import { ENTITY_FIELDS } from './entities';

export const CASE_FIELDS = gql`
  fragment CaseFields on Case {
    id
    title
    description
    status
    tlp
    priority
    assignee
    tags
    createdAt
    updatedAt
    closedAt
  }
`;

export const GET_CASE = gql`
  ${CASE_FIELDS}
  ${ENTITY_FIELDS}
  query GetCase($id: ID!) {
    case_(id: $id) {
      ...CaseFields
      entities {
        ...EntityFields
      }
      notes {
        id
        content
        author
        tlp
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_CASES = gql`
  ${CASE_FIELDS}
  query GetCases(
    $status: [CaseStatus!]
    $tlp: [TLPLevel!]
    $priority: [Severity!]
    $assignee: String
    $search: String
    $limit: Int
    $offset: Int
    $sortBy: String
    $sortOrder: String
  ) {
    cases(
      status: $status
      tlp: $tlp
      priority: $priority
      assignee: $assignee
      search: $search
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortOrder: $sortOrder
    ) {
      items {
        ...CaseFields
        entityCount
      }
      total
    }
  }
`;
