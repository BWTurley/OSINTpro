import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { SEVERITY_COLORS } from '@/utils/constants';
import type { GeoEvent } from '@/types';

// Demo events -- in production these come from ACLED/GDELT via API
const demoEvents: GeoEvent[] = [
  { id: '1', lat: 48.8566, lng: 2.3522, type: 'cyber', title: 'Phishing Campaign', description: 'Large-scale phishing targeting EU banks', source: 'GDELT', date: '2026-04-05', severity: 'high' },
  { id: '2', lat: 38.9072, lng: -77.0369, type: 'breach', title: 'Data Breach', description: 'Government contractor breach reported', source: 'OSINT', date: '2026-04-04', severity: 'critical' },
  { id: '3', lat: 35.6762, lng: 139.6503, type: 'malware', title: 'Ransomware Spread', description: 'New variant spreading across APAC', source: 'ACLED', date: '2026-04-03', severity: 'medium' },
  { id: '4', lat: -33.8688, lng: 151.2093, type: 'ddos', title: 'DDoS Attack', description: 'Infrastructure targeted', source: 'GDELT', date: '2026-04-05', severity: 'low' },
];

export const GlobalEventMap: React.FC = () => {
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
          {demoEvents.map((event) => (
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
