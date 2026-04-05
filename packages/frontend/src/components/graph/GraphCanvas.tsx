import React, { useRef, useEffect, useCallback, useState } from 'react';
import cytoscape, { type Core, type EventObject } from 'cytoscape';
import { ENTITY_COLORS } from '@/utils/constants';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { NodeContextMenu } from './NodeContextMenu';
import type { CytoscapeElement } from '@/hooks/useGraph';

interface GraphCanvasProps {
  elements: CytoscapeElement[];
  layout: string;
  loading: boolean;
  onNodeSelect?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

const layoutOptions: Record<string, object> = {
  cose: {
    name: 'cose',
    animate: true,
    animationDuration: 500,
    nodeRepulsion: () => 8000,
    idealEdgeLength: () => 120,
    gravity: 0.25,
  },
  breadthfirst: {
    name: 'breadthfirst',
    animate: true,
    directed: true,
    spacingFactor: 1.5,
  },
  circle: {
    name: 'circle',
    animate: true,
    spacingFactor: 1.2,
  },
  grid: {
    name: 'grid',
    animate: true,
    spacingFactor: 1.2,
  },
  concentric: {
    name: 'concentric',
    animate: true,
    minNodeSpacing: 60,
  },
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  elements,
  layout,
  loading,
  onNodeSelect,
  onNodeDoubleClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    nodeId: null,
  });

  const initCytoscape = useCallback(() => {
    if (!containerRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 8,
            'font-size': '12px',
            color: '#d1d5db',
            'text-outline-width': 2,
            'text-outline-color': '#0f172a',
            'background-color': 'data(color)',
            width: 40,
            height: 40,
            'border-width': 2,
            'border-color': '#334155',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#60a5fa',
            'overlay-opacity': 0.1,
            'overlay-color': '#3b82f6',
          },
        },
        {
          selector: 'edge',
          style: {
            label: 'data(label)',
            'font-size': '10px',
            color: '#6b7280',
            'text-outline-width': 1,
            'text-outline-color': '#0f172a',
            'text-rotation': 'autorotate',
            width: 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#60a5fa',
            'target-arrow-color': '#60a5fa',
            width: 3,
          },
        },
        {
          selector: ':active',
          style: {
            'overlay-opacity': 0,
          },
        },
      ],
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: true,
      selectionType: 'additive',
    });

    // Event handlers
    cy.on('tap', 'node', (e: EventObject) => {
      const nodeId = e.target.id() as string;
      onNodeSelect?.(nodeId);
    });

    cy.on('dbltap', 'node', (e: EventObject) => {
      const nodeId = e.target.id() as string;
      onNodeDoubleClick?.(nodeId);
    });

    cy.on('cxttap', 'node', (e: EventObject) => {
      const nodeId = e.target.id() as string;
      const pos = e.renderedPosition;
      setContextMenu({
        visible: true,
        x: (pos as { x: number; y: number }).x,
        y: (pos as { x: number; y: number }).y,
        nodeId,
      });
    });

    cy.on('tap', () => {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    });

    cyRef.current = cy;
  }, [onNodeSelect, onNodeDoubleClick]);

  // Initialize
  useEffect(() => {
    initCytoscape();
    return () => {
      cyRef.current?.destroy();
    };
  }, [initCytoscape]);

  // Update elements
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().remove();
    if (elements.length > 0) {
      cy.add(elements as cytoscape.ElementDefinition[]);
      const layoutOpts = layoutOptions[layout] ?? layoutOptions.cose;
      cy.layout(layoutOpts as cytoscape.LayoutOptions).run();
    }
  }, [elements, layout]);

  // Re-run layout on layout change
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.elements().length === 0) return;

    const layoutOpts = layoutOptions[layout] ?? layoutOptions.cose;
    cy.layout(layoutOpts as cytoscape.LayoutOptions).run();
  }, [layout]);

  const handleContextAction = useCallback(
    (action: string) => {
      const cy = cyRef.current;
      if (!cy || !contextMenu.nodeId) return;

      const node = cy.getElementById(contextMenu.nodeId);

      switch (action) {
        case 'expand':
          onNodeDoubleClick?.(contextMenu.nodeId);
          break;
        case 'hide':
          node.remove();
          break;
        case 'pin':
          node.lock();
          break;
        case 'unpin':
          node.unlock();
          break;
        case 'select-neighbors':
          node.neighborhood().select();
          break;
      }

      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [contextMenu.nodeId, onNodeDoubleClick]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Loading graph..." />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <p className="text-lg text-gray-500">No graph data</p>
            <p className="text-base text-gray-600">Search for an entity to visualize its relationships</p>
          </div>
        </div>
      )}

      {contextMenu.visible && contextMenu.nodeId && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onAction={handleContextAction}
          onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        />
      )}

      {/* Legend */}
      {elements.length > 0 && (
        <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-surface-900/90 border border-gray-700/50 backdrop-blur-sm">
          <div className="flex flex-wrap gap-3">
            {Object.entries(ENTITY_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-400 capitalize">
                  {type.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
