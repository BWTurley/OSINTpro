import React from 'react';
import { useQuery } from '@apollo/client';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { SEARCH } from '@/graphql/queries/search';
import { SEVERITY_COLORS } from '@/utils/constants';
import type { GeoEvent } from '@/types';

export const GlobalEventMap: React.FC = () => {
  const { data } = useQuery(SEARCH, {
    variables: { query: '*', types: ['LOCATION'], limit: 50 },
  });

  const events: GeoEvent[] = (data?.search?.entities ?? [])
    .filter((e: Record<string, unknown>) => {
      const d = e.data as Record<string, unknown> | undefined;
      return d?.latitude && d?.longitude;
    })
    .map((e: Record<string, unknown>) => {
      const d = e.data as Record<string, unknown>;
      return {
        id: e.id as string,
        lat: d.latitude as number,
        lng: d.longitude as number,
        type: 'cyber',
        title: (d.name ?? e.id) as string,
        description: '',
        source: 'OSINT',
        date: e.createdAt as string,
        severity: 'medium' as const,
      };
    });

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-gray-100">Global Events</h3>
      <div className="h-64 rounded-lg overflow-hidden border border-gray-700/50">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {events.map((event) => (
            <CircleMarker
              key={event.id}
              center={[event.lat, event.lng]}
              radius={8}
              pathOptions={{
                color: SEVERITY_COLORS[event.severity],
                fillColor: SEVERITY_COLORS[event.severity],
                fillOpacity: 0.6,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm space-y-1">
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-gray-600">{event.description}</p>
                  <p className="text-gray-500">{event.source} - {event.date}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};
