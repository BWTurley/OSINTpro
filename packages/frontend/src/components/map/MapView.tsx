import React, { useState } from 'react';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { EntityMarkers } from './EntityMarkers';
import { MapControls } from './MapControls';
import { MapLayers } from './MapLayers';
import { TimelineSlider } from './TimelineSlider';
import type { Entity } from '@/types';

const { BaseLayer } = LayersControl;

// Demo entities with location data
const demoEntities: Entity[] = [];

interface LayerConfig {
  id: string;
  label: string;
  visible: boolean;
  opacity: number;
}

export const MapView: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [overlayLayers, setOverlayLayers] = useState<LayerConfig[]>([
    { id: 'entities', label: 'Entity Markers', visible: true, opacity: 1 },
    { id: 'heatmap', label: 'Event Heatmap', visible: false, opacity: 0.7 },
    { id: 'tracks', label: 'Flight Tracks', visible: false, opacity: 0.8 },
  ]);
  const [timelineDate, setTimelineDate] = useState(new Date());

  const toggleLayer = (layerId: string) => {
    setOverlayLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  };

  const setLayerOpacity = (layerId: string, opacity: number) => {
    setOverlayLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  };

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex-1 relative">
        <MapContainer
          center={[20, 0]}
          zoom={3}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <LayersControl position="topright">
            <BaseLayer checked name="Dark">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              />
            </BaseLayer>
            <BaseLayer name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://osm.org/copyright">OSM</a>'
              />
            </BaseLayer>
            <BaseLayer name="Satellite">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri"
              />
            </BaseLayer>
          </LayersControl>

          {overlayLayers.find((l) => l.id === 'entities')?.visible && (
            <EntityMarkers entities={demoEntities} />
          )}
        </MapContainer>

        <MapControls
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onExport={() => {
            // TODO: Implement map export
          }}
        />

        <MapLayers
          layers={overlayLayers}
          onToggle={toggleLayer}
          onOpacityChange={setLayerOpacity}
        />
      </div>

      {/* Timeline slider */}
      <div className="p-3">
        <TimelineSlider
          startDate={new Date('2026-01-01')}
          endDate={new Date('2026-04-05')}
          currentDate={timelineDate}
          onChange={setTimelineDate}
        />
      </div>
    </div>
  );
};
