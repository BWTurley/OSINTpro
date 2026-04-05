import React from 'react';
import { MapView } from '@/components/map/MapView';

const MapPage: React.FC = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Map View</h1>
        <p className="text-base text-gray-400 mt-1">Geospatial intelligence visualization</p>
      </div>
      <div className="flex-1 rounded-xl border border-gray-700/50 overflow-hidden">
        <MapView />
      </div>
    </div>
  );
};

export default MapPage;
