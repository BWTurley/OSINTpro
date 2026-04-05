import neo4j, { Driver, Session, Integer } from 'neo4j-driver';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PathSegment {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

export class GraphService {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      config.NEO4J_URI,
      neo4j.auth.basic(config.NEO4J_USERNAME, config.NEO4J_PASSWORD),
    );
  }

  private getSession(): Session {
    return this.driver.session();
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async verifyConnectivity(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }

  async createNode(id: string, label: string, properties: Record<string, unknown>): Promise<GraphNode> {
    const session = this.getSession();
    try {
      const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, '_');
      const result = await session.run(
        `CREATE (n:Entity:${safeLabel} {id: $id}) SET n += $props RETURN n`,
        { id, props: this.sanitizeProperties(properties) },
      );
      const node = result.records[0]?.get('n');
      return {
        id,
        label,
        properties: node ? node.properties : properties,
      };
    } finally {
      await session.close();
    }
  }

  async updateNodeProperties(id: string, properties: Record<string, unknown>): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        'MATCH (n:Entity {id: $id}) SET n += $props',
        { id, props: this.sanitizeProperties(properties) },
      );
    } finally {
      await session.close();
    }
  }

  async deleteNode(id: string): Promise<void> {
    const session = this.getSession();
    try {
      await session.run('MATCH (n:Entity {id: $id}) DETACH DELETE n', { id });
    } finally {
      await session.close();
    }
  }

  async createRelationship(
    sourceId: string,
    targetId: string,
    type: string,
    properties: Record<string, unknown>,
    relationshipId: string,
  ): Promise<GraphEdge> {
    const session = this.getSession();
    const safeType = type.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
    try {
      const result = await session.run(
        `MATCH (a:Entity {id: $sourceId}), (b:Entity {id: $targetId})
         CREATE (a)-[r:${safeType} {id: $relId}]->(b)
         SET r += $props
         RETURN r`,
        {
          sourceId,
          targetId,
          relId: relationshipId,
          props: this.sanitizeProperties(properties),
        },
      );
      const rel = result.records[0]?.get('r');
      return {
        id: relationshipId,
        source: sourceId,
        target: targetId,
        type,
        properties: rel ? rel.properties : properties,
      };
    } finally {
      await session.close();
    }
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        'MATCH ()-[r {id: $id}]-() DELETE r',
        { id: relationshipId },
      );
    } finally {
      await session.close();
    }
  }

  async mergeNodes(sourceId: string, targetId: string): Promise<void> {
    const session = this.getSession();
    try {
      // Move all relationships from source to target
      await session.run(
        `MATCH (source:Entity {id: $sourceId})-[r]->(other)
         MATCH (target:Entity {id: $targetId})
         WHERE other.id <> $targetId
         CREATE (target)-[newR:MERGED_REL]->(other)
         SET newR = properties(r)
         DELETE r`,
        { sourceId, targetId },
      );

      await session.run(
        `MATCH (other)-[r]->(source:Entity {id: $sourceId})
         MATCH (target:Entity {id: $targetId})
         WHERE other.id <> $targetId
         CREATE (other)-[newR:MERGED_REL]->(target)
         SET newR = properties(r)
         DELETE r`,
        { sourceId, targetId },
      );

      // Delete source node
      await session.run(
        'MATCH (n:Entity {id: $sourceId}) DETACH DELETE n',
        { sourceId },
      );
    } finally {
      await session.close();
    }
  }

  async shortestPath(sourceId: string, targetId: string, maxDepth: number = 10): Promise<PathSegment | null> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `MATCH (a:Entity {id: $sourceId}), (b:Entity {id: $targetId}),
               p = shortestPath((a)-[*..${maxDepth}]-(b))
         RETURN p`,
        { sourceId, targetId },
      );

      if (result.records.length === 0) return null;

      const path = result.records[0].get('p');
      return this.pathToSegment(path);
    } finally {
      await session.close();
    }
  }

  async allPaths(sourceId: string, targetId: string, maxDepth: number = 5): Promise<PathSegment[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `MATCH p = allShortestPaths((a:Entity {id: $sourceId})-[*..${maxDepth}]-(b:Entity {id: $targetId}))
         RETURN p LIMIT 20`,
        { sourceId, targetId },
      );

      return result.records.map((record) => this.pathToSegment(record.get('p')));
    } finally {
      await session.close();
    }
  }

  async entityGraph(entityId: string, depth: number = 2): Promise<GraphData> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `MATCH path = (start:Entity {id: $entityId})-[*1..${depth}]-(connected)
         RETURN path`,
        { entityId },
      );

      const nodesMap = new Map<string, GraphNode>();
      const edgesMap = new Map<string, GraphEdge>();

      for (const record of result.records) {
        const path = record.get('path');
        for (const segment of path.segments) {
          const startNode = segment.start;
          const endNode = segment.end;
          const rel = segment.relationship;

          const startId = startNode.properties.id as string;
          const endId = endNode.properties.id as string;

          if (!nodesMap.has(startId)) {
            nodesMap.set(startId, {
              id: startId,
              label: startNode.labels.filter((l: string) => l !== 'Entity')[0] ?? 'Entity',
              properties: this.recordToObject(startNode.properties),
            });
          }

          if (!nodesMap.has(endId)) {
            nodesMap.set(endId, {
              id: endId,
              label: endNode.labels.filter((l: string) => l !== 'Entity')[0] ?? 'Entity',
              properties: this.recordToObject(endNode.properties),
            });
          }

          const relId = rel.properties.id as string || `${startId}-${endId}`;
          if (!edgesMap.has(relId)) {
            edgesMap.set(relId, {
              id: relId,
              source: startId,
              target: endId,
              type: rel.type,
              properties: this.recordToObject(rel.properties),
            });
          }
        }
      }

      return {
        nodes: Array.from(nodesMap.values()),
        edges: Array.from(edgesMap.values()),
      };
    } finally {
      await session.close();
    }
  }

  async communityDetection(): Promise<Array<{ community: number; members: string[] }>> {
    const session = this.getSession();
    try {
      // Use weakly connected components as a community detection proxy
      const result = await session.run(
        `CALL {
           MATCH (n:Entity)
           RETURN n, id(n) as nodeId
         }
         WITH collect({node: n, nodeId: nodeId}) as nodes
         UNWIND nodes as nodeData
         MATCH (nodeData.node)-[r]-(other:Entity)
         WITH nodeData.node as n, collect(distinct other.id) as neighbors
         RETURN n.id as entityId, neighbors
         LIMIT 1000`,
      );

      // Simple client-side community detection using connected components
      const adjacencyList = new Map<string, Set<string>>();

      for (const record of result.records) {
        const entityId = record.get('entityId') as string;
        const neighbors = record.get('neighbors') as string[];
        if (!adjacencyList.has(entityId)) {
          adjacencyList.set(entityId, new Set());
        }
        for (const neighbor of neighbors) {
          adjacencyList.get(entityId)!.add(neighbor);
          if (!adjacencyList.has(neighbor)) {
            adjacencyList.set(neighbor, new Set());
          }
          adjacencyList.get(neighbor)!.add(entityId);
        }
      }

      // BFS-based connected components
      const visited = new Set<string>();
      const communities: Array<{ community: number; members: string[] }> = [];
      let communityId = 0;

      for (const nodeId of adjacencyList.keys()) {
        if (visited.has(nodeId)) continue;

        const members: string[] = [];
        const queue = [nodeId];
        visited.add(nodeId);

        while (queue.length > 0) {
          const current = queue.shift()!;
          members.push(current);

          const neighbors = adjacencyList.get(current) ?? new Set();
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        communities.push({ community: communityId++, members });
      }

      return communities;
    } finally {
      await session.close();
    }
  }

  async centralityAnalysis(): Promise<Array<{ entityId: string; score: number }>> {
    const session = this.getSession();
    try {
      // Degree centrality -- number of connections per node
      const result = await session.run(
        `MATCH (n:Entity)
         OPTIONAL MATCH (n)-[r]-()
         WITH n.id as entityId, count(r) as degree
         RETURN entityId, toFloat(degree) as score
         ORDER BY score DESC
         LIMIT 100`,
      );

      return result.records.map((record) => ({
        entityId: record.get('entityId') as string,
        score: record.get('score') as number,
      }));
    } finally {
      await session.close();
    }
  }

  private pathToSegment(path: { segments: Array<{ start: { properties: Record<string, unknown>; labels: string[] }; end: { properties: Record<string, unknown>; labels: string[] }; relationship: { type: string; properties: Record<string, unknown> } }> }): PathSegment {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenNodes = new Set<string>();

    for (const segment of path.segments) {
      const startId = segment.start.properties.id as string;
      const endId = segment.end.properties.id as string;

      if (!seenNodes.has(startId)) {
        seenNodes.add(startId);
        nodes.push({
          id: startId,
          label: segment.start.labels.filter((l: string) => l !== 'Entity')[0] ?? 'Entity',
          properties: this.recordToObject(segment.start.properties),
        });
      }

      if (!seenNodes.has(endId)) {
        seenNodes.add(endId);
        nodes.push({
          id: endId,
          label: segment.end.labels.filter((l: string) => l !== 'Entity')[0] ?? 'Entity',
          properties: this.recordToObject(segment.end.properties),
        });
      }

      edges.push({
        id: (segment.relationship.properties.id as string) || `${startId}-${endId}`,
        source: startId,
        target: endId,
        type: segment.relationship.type,
        properties: this.recordToObject(segment.relationship.properties),
      });
    }

    return { nodes, edges, length: edges.length };
  }

  private sanitizeProperties(props: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = JSON.stringify(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private recordToObject(properties: Record<string, unknown>): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (neo4j.isInt(value)) {
        obj[key] = (value as Integer).toNumber();
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }
}
