import { useCallback, useMemo } from 'react';
import { useLazyQuery } from '@apollo/client';
import { GET_ENTITY_GRAPH } from '@/graphql/queries/entities';
import { useEntityStore } from '@/stores/entityStore';
import { ENTITY_COLORS } from '@/utils/constants';
import type { EntityType, GraphData } from '@/types';

interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    type: EntityType;
    confidence: number;
    color: string;
    metadata: Record<string, unknown>;
  };
}

interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label: string;
    type: string;
    confidence: number;
  };
}

export type CytoscapeElement = CytoscapeNode | CytoscapeEdge;

export function useGraph() {
  const { graphData, setGraphData, setLoading } = useEntityStore();

  const [fetchGraph, { loading, error }] = useLazyQuery(GET_ENTITY_GRAPH, {
    onCompleted: (data) => {
      if (data?.entityGraph) {
        setGraphData(data.entityGraph as GraphData);
      }
      setLoading(false);
    },
    onError: () => {
      setLoading(false);
    },
  });

  const loadGraph = useCallback(
    (entityId: string, depth = 2, types?: EntityType[]) => {
      setLoading(true);
      fetchGraph({ variables: { entityId, depth, types } });
    },
    [fetchGraph, setLoading]
  );

  const cytoscapeElements = useMemo((): CytoscapeElement[] => {
    if (!graphData) return [];

    const nodes: CytoscapeNode[] = graphData.nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        confidence: node.confidence,
        color: ENTITY_COLORS[node.type] ?? '#6b7280',
        metadata: node.metadata,
      },
    }));

    const edges: CytoscapeEdge[] = graphData.edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
        confidence: edge.confidence,
      },
    }));

    return [...nodes, ...edges];
  }, [graphData]);

  const clearGraph = useCallback(() => {
    setGraphData(null);
  }, [setGraphData]);

  return {
    graphData,
    cytoscapeElements,
    loading,
    error,
    loadGraph,
    clearGraph,
  };
}
