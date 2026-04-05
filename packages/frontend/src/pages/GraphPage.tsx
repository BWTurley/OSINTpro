import React, { useState } from 'react';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { GraphControls } from '@/components/graph/GraphControls';
import { GraphFilters } from '@/components/graph/GraphFilters';
import { useGraph } from '@/hooks/useGraph';

const GraphPage: React.FC = () => {
  const { cytoscapeElements, loading, loadGraph } = useGraph();
  const [layout, setLayout] = useState('cose');
  const [showFilters, setShowFilters] = useState(true);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Graph Explorer</h1>
          <p className="text-base text-gray-400 mt-1">Entity relationship visualization</p>
        </div>
        <GraphControls
          layout={layout}
          onLayoutChange={setLayout}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
        />
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {showFilters && (
          <GraphFilters onSearch={(entityId) => loadGraph(entityId)} />
        )}
        <div className="flex-1 rounded-xl border border-gray-700/50 overflow-hidden bg-surface-900">
          <GraphCanvas elements={cytoscapeElements} layout={layout} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default GraphPage;
