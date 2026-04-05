export const typeDefs = `#graphql
  scalar JSON
  scalar DateTime

  enum EntityType {
    PERSON
    ORGANIZATION
    DOMAIN
    IP_ADDRESS
    EMAIL
    PHONE
    CRYPTOCURRENCY
    SOCIAL_MEDIA
    VEHICLE
    LOCATION
  }

  enum TLPLevel {
    WHITE
    GREEN
    AMBER
    AMBER_STRICT
    RED
  }

  enum Role {
    ADMIN
    ANALYST
    VIEWER
    API_USER
  }

  enum CaseStatus {
    OPEN
    IN_PROGRESS
    CLOSED
    ARCHIVED
  }

  enum JobStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: Role!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastLogin: DateTime
  }

  type Entity {
    id: ID!
    entityType: EntityType!
    data: JSON!
    confidence: Float!
    admiraltySource: String
    admiraltyCredibility: String
    tlpLevel: TLPLevel!
    tags: [String!]!
    sources: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
    relationships: [Relationship!]!
    notes: [Note!]!
    cases: [Case!]!
  }

  type Relationship {
    id: ID!
    sourceEntityId: ID!
    sourceEntityType: String!
    targetEntityId: ID!
    targetEntityType: String!
    relationshipType: String!
    confidence: Float!
    admiraltySource: String
    admiraltyCredibility: String
    source: String
    description: String
    startDate: DateTime
    endDate: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    sourceEntity: Entity
    targetEntity: Entity
  }

  type Case {
    id: ID!
    name: String!
    description: String
    status: CaseStatus!
    createdBy: User!
    tlpLevel: TLPLevel!
    tags: [String!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    entities: [Entity!]!
    notes: [Note!]!
    entityCount: Int!
  }

  type Note {
    id: ID!
    entityId: ID!
    caseId: ID
    content: String!
    author: User!
    classification: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CollectionJob {
    id: ID!
    entityId: ID!
    modules: [String!]!
    status: JobStatus!
    progress: Float!
    results: JSON
    error: String
    createdAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
  }

  type ScheduledJob {
    id: ID!
    name: String!
    cronExpression: String!
    moduleNames: [String!]!
    entityFilter: JSON
    enabled: Boolean!
    lastRun: DateTime
    nextRun: DateTime
    createdAt: DateTime!
  }

  type ModuleStatus {
    moduleName: String!
    enabled: Boolean!
    configured: Boolean!
    lastUsed: DateTime
  }

  type SearchHit {
    id: ID!
    entityType: EntityType!
    data: JSON!
    confidence: Float!
    tags: [String!]!
    score: Float!
  }

  type SearchResults {
    hits: [SearchHit!]!
    total: Int!
    aggregations: JSON
    suggestions: [String!]
  }

  type DashboardStats {
    totalEntities: Int!
    totalRelationships: Int!
    totalCases: Int!
    entitiesByType: JSON!
    recentEntities: [Entity!]!
    activeCases: [Case!]!
    activeJobs: Int!
  }

  type ThreatIndicator {
    id: ID!
    entityType: EntityType!
    value: String!
    confidence: Float!
    tlpLevel: TLPLevel!
    tags: [String!]!
    firstSeen: DateTime!
    lastSeen: DateTime!
  }

  type GraphNode {
    id: ID!
    label: String!
    properties: JSON!
  }

  type GraphEdge {
    id: ID!
    source: ID!
    target: ID!
    type: String!
    properties: JSON!
  }

  type Graph {
    nodes: [GraphNode!]!
    edges: [GraphEdge!]!
  }

  type PathSegment {
    nodes: [GraphNode!]!
    edges: [GraphEdge!]!
    length: Int!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  type EntityEdge {
    node: Entity!
    cursor: String!
  }

  type EntityConnection {
    edges: [EntityEdge!]!
    pageInfo: PageInfo!
  }

  type AuditLog {
    id: ID!
    userId: ID
    action: String!
    entityType: String
    entityId: ID
    details: JSON
    sourceIp: String
    previousHash: String
    timestamp: DateTime!
  }

  type ApiKeyConfig {
    id: ID!
    moduleName: String!
    enabled: Boolean!
    config: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SavedSearch {
    id: ID!
    name: String!
    query: JSON!
    userId: ID!
    alertEnabled: Boolean!
    alertChannels: JSON!
    createdAt: DateTime!
  }

  type BulkImportResult {
    imported: Int!
    failed: Int!
    errors: [String!]!
    entities: [Entity!]!
  }

  type QueueStats {
    waiting: Int!
    active: Int!
    completed: Int!
    failed: Int!
    delayed: Int!
  }

  type CommunityResult {
    community: Int!
    members: [ID!]!
  }

  type CentralityResult {
    entityId: ID!
    score: Float!
  }

  # Inputs

  input CreateEntityInput {
    entityType: EntityType!
    data: JSON!
    confidence: Float
    admiraltySource: String
    admiraltyCredibility: String
    tlpLevel: TLPLevel
    tags: [String!]
    sources: JSON
  }

  input UpdateEntityInput {
    data: JSON
    confidence: Float
    admiraltySource: String
    admiraltyCredibility: String
    tlpLevel: TLPLevel
    tags: [String!]
    sources: JSON
  }

  input CreateRelationshipInput {
    sourceEntityId: ID!
    sourceEntityType: String!
    targetEntityId: ID!
    targetEntityType: String!
    relationshipType: String!
    confidence: Float
    admiraltySource: String
    admiraltyCredibility: String
    source: String
    description: String
    startDate: DateTime
    endDate: DateTime
  }

  input UpdateRelationshipInput {
    relationshipType: String
    confidence: Float
    admiraltySource: String
    admiraltyCredibility: String
    source: String
    description: String
    startDate: DateTime
    endDate: DateTime
  }

  input CreateCaseInput {
    name: String!
    description: String
    status: CaseStatus
    tlpLevel: TLPLevel
    tags: [String!]
  }

  input UpdateCaseInput {
    name: String
    description: String
    status: CaseStatus
    tlpLevel: TLPLevel
    tags: [String!]
  }

  input CreateNoteInput {
    entityId: ID!
    caseId: ID
    content: String!
    classification: String
  }

  input UpdateNoteInput {
    content: String!
    classification: String
  }

  input SearchInput {
    query: String!
    entityTypes: [EntityType!]
    tlpLevels: [TLPLevel!]
    tags: [String!]
    dateFrom: DateTime
    dateTo: DateTime
    page: Int
    size: Int
  }

  input TriggerCollectionInput {
    entityId: ID!
    modules: [String!]!
  }

  input BulkImportInput {
    entities: [CreateEntityInput!]!
  }

  input ModuleConfigInput {
    moduleName: String!
    apiKey: String!
    enabled: Boolean
    config: JSON
  }

  input CreateScheduledJobInput {
    name: String!
    cronExpression: String!
    moduleNames: [String!]!
    entityFilter: JSON
    enabled: Boolean
  }

  input EntityFilterInput {
    entityType: EntityType
    tags: [String!]
    tlpLevel: TLPLevel
    first: Int
    after: String
  }

  # Root types

  type Query {
    # Entities
    entity(id: ID!): Entity
    entities(filter: EntityFilterInput): EntityConnection!
    searchEntities(input: SearchInput!): SearchResults!

    # Relationships
    relationships(entityId: ID!): [Relationship!]!
    relationship(id: ID!): Relationship

    # Graph
    shortestPath(sourceId: ID!, targetId: ID!, maxDepth: Int): PathSegment
    entityGraph(entityId: ID!, depth: Int): Graph!

    # Cases
    case(id: ID!): Case
    cases(status: CaseStatus, first: Int, after: String): [Case!]!

    # Collection
    collectionJobs(entityId: ID): [CollectionJob!]!
    collectionJob(id: ID!): CollectionJob
    moduleStatus: [ModuleStatus!]!

    # Search
    search(input: SearchInput!): SearchResults!
    suggest(prefix: String!, size: Int): [String!]!

    # Dashboard
    dashboardStats: DashboardStats!
    threatFeed(limit: Int, tlpLevel: TLPLevel): [ThreatIndicator!]!

    # Admin
    auditLogs(
      userId: ID
      action: String
      entityType: String
      from: DateTime
      to: DateTime
      page: Int
      size: Int
    ): [AuditLog!]!
    queueStats: QueueStats!
    communityDetection: [CommunityResult!]!
    centralityAnalysis: [CentralityResult!]!

    # Saved searches
    savedSearches: [SavedSearch!]!
    savedSearch(id: ID!): SavedSearch
  }

  type Mutation {
    # Entities
    createEntity(input: CreateEntityInput!): Entity!
    updateEntity(id: ID!, input: UpdateEntityInput!): Entity!
    mergeEntities(sourceId: ID!, targetId: ID!): Entity!
    deleteEntity(id: ID!): Boolean!

    # Relationships
    createRelationship(input: CreateRelationshipInput!): Relationship!
    updateRelationship(id: ID!, input: UpdateRelationshipInput!): Relationship!
    deleteRelationship(id: ID!): Boolean!

    # Collection
    triggerCollection(input: TriggerCollectionInput!): CollectionJob!
    cancelCollection(jobId: ID!): Boolean!
    bulkImport(input: BulkImportInput!): BulkImportResult!

    # Cases
    createCase(input: CreateCaseInput!): Case!
    updateCase(id: ID!, input: UpdateCaseInput!): Case!
    addEntityToCase(caseId: ID!, entityId: ID!): Case!
    removeEntityFromCase(caseId: ID!, entityId: ID!): Case!

    # Notes
    addNote(input: CreateNoteInput!): Note!
    updateNote(id: ID!, input: UpdateNoteInput!): Note!
    deleteNote(id: ID!): Boolean!

    # Admin
    updateModuleConfig(input: ModuleConfigInput!): ApiKeyConfig!
    createScheduledJob(input: CreateScheduledJobInput!): ScheduledJob!

    # Saved searches
    createSavedSearch(name: String!, query: JSON!, alertEnabled: Boolean, alertChannels: JSON): SavedSearch!
    deleteSavedSearch(id: ID!): Boolean!
  }

  type Subscription {
    collectionJobUpdated(jobId: ID!): CollectionJob!
    entityUpdated(entityId: ID): Entity!
    alertTriggered: ThreatIndicator!
  }
`;
