import { gql } from '@apollo/client';

export const ENTITY_FIELDS = gql`
  fragment EntityFields on Entity {
    id
    type
    value
    label
    confidence
    admiraltyCode {
      reliability
      credibility
    }
    tlp
    tags
    sources
    firstSeen
    lastSeen
    metadata
    createdAt
    updatedAt
  }
`;

export const GET_ENTITY = gql`
  ${ENTITY_FIELDS}
  query GetEntity($id: ID!) {
    entity(id: $id) {
      ...EntityFields
      relationships {
        id
        sourceId
        targetId
        type
        label
        confidence
        firstSeen
        lastSeen
        metadata
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

export const SEARCH_ENTITIES = gql`
  ${ENTITY_FIELDS}
  query SearchEntities(
    $query: String!
    $types: [EntityType!]
    $sources: [String!]
    $minConfidence: Int
    $tlp: [TLPLevel!]
    $tags: [String!]
    $dateFrom: DateTime
    $dateTo: DateTime
    $limit: Int
    $offset: Int
  ) {
    searchEntities(
      query: $query
      types: $types
      sources: $sources
      minConfidence: $minConfidence
      tlp: $tlp
      tags: $tags
      dateFrom: $dateFrom
      dateTo: $dateTo
      limit: $limit
      offset: $offset
    ) {
      entities {
        ...EntityFields
      }
      total
      facets {
        type {
          key
          count
        }
        source {
          key
          count
        }
        tlp {
          key
          count
        }
      }
    }
  }
`;

export const GET_ENTITY_GRAPH = gql`
  query GetEntityGraph($entityId: ID!, $depth: Int, $types: [EntityType!]) {
    entityGraph(entityId: $entityId, depth: $depth, types: $types) {
      nodes {
        id
        type
        label
        confidence
        metadata
      }
      edges {
        id
        source
        target
        type
        label
        confidence
      }
    }
  }
`;
