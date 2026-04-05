import { gql } from '@apollo/client';
import { ENTITY_FIELDS } from './entities';

export const SEARCH = gql`
  ${ENTITY_FIELDS}
  query Search(
    $query: String!
    $types: [EntityType!]
    $sources: [String!]
    $minConfidence: Int
    $maxConfidence: Int
    $tlp: [TLPLevel!]
    $tags: [String!]
    $dateFrom: DateTime
    $dateTo: DateTime
    $limit: Int
    $offset: Int
    $sortBy: String
    $sortOrder: String
  ) {
    search(
      query: $query
      types: $types
      sources: $sources
      minConfidence: $minConfidence
      maxConfidence: $maxConfidence
      tlp: $tlp
      tags: $tags
      dateFrom: $dateFrom
      dateTo: $dateTo
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortOrder: $sortOrder
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
        tag {
          key
          count
        }
      }
    }
  }
`;

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    dashboardStats {
      totalEntities
      totalCases
      activeCases
      activeJobs
      alertsCritical
      alertsHigh
      alertsMedium
      alertsLow
      modulesHealthy
      modulesTotal
    }
  }
`;

export const GET_THREAT_FEED = gql`
  query GetThreatFeed($limit: Int, $types: [EntityType!]) {
    threatFeed(limit: $limit, types: $types) {
      id
      value
      type
      source
      confidence
      tags
      firstSeen
      lastSeen
      threatScore
    }
  }
`;

export const GET_ALERTS = gql`
  query GetAlerts($severity: [Severity!], $read: Boolean, $limit: Int) {
    alerts(severity: $severity, read: $read, limit: $limit) {
      items {
        id
        title
        message
        severity
        source
        entityId
        read
        createdAt
      }
      total
    }
  }
`;
