import React from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import { ENTITY_COLORS } from '@/utils/constants';
import { entityTypeLabel, formatRelativeTime } from '@/utils/formatters';
import type { Entity } from '@/types';

interface EntityMarkersProps {
  entities: Entity[];
  onSelect?: (entity: Entity) => void;
}

export const EntityMarkers: React.FC<EntityMarkersProps> = ({ entities, onSelect }) => {
  return (
    <>
      {entities
        .filter((e) => {
          const meta = e.metadata as { lat?: number; lng?: number };
          return meta.lat !== undefined && meta.lng !== undefined;
        })
        .map((entity) => {
          const meta = entity.metadata as { lat: number; lng: number };
          const color = ENTITY_COLORS[entity.type] ?? '#6b7280';

          return (
            <CircleMarker
              key={entity.id}
              center={[meta.lat, meta.lng]}
              radius={8}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.6,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onSelect?.(entity),
              }}
            >
              <Popup>
                <div className="text-sm space-y-1 min-w-[180px]">
                  <p className="font-semibold text-gray-900">{entity.label || entity.value}</p>
                  <p className="text-gray-600">
                    Type: {entityTypeLabel(entity.type)}
                  </p>
                  <p className="text-gray-600">
                    Confidence: {entity.confidence}%
                  </p>
                  <p className="text-gray-500 text-xs">
                    Last seen: {formatRelativeTime(entity.lastSeen)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </>
  );
};
