import { gql } from '@apollo/client';

export const GET_COLLECTION_JOBS = gql`
  query GetCollectionJobs(
    $status: [JobStatus!]
    $module: String
    $entityId: ID
    $limit: Int
    $offset: Int
  ) {
    collectionJobs(
      status: $status
      module: $module
      entityId: $entityId
      limit: $limit
      offset: $offset
    ) {
      items {
        id
        module
        entityId
        entityValue
        status
        progress
        resultCount
        error
        startedAt
        completedAt
        createdAt
      }
      total
      counts {
        queued
        running
        completed
        failed
      }
    }
  }
`;

export const GET_MODULE_STATUS = gql`
  query GetModuleStatus {
    intelModules {
      id
      name
      description
      enabled
      healthy
      entityTypes
      rateLimitUsed
      rateLimitMax
      lastChecked
    }
  }
`;

export const SUBSCRIBE_JOB_UPDATES = gql`
  subscription OnJobUpdate($jobId: ID) {
    jobUpdated(jobId: $jobId) {
      id
      status
      progress
      resultCount
      error
      completedAt
    }
  }
`;
