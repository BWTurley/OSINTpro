import React from 'react';
import { Polyline, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

interface FlightTrack {
  id: string;
  label: string;
  type: 'aircraft' | 'vessel';
  points: TrackPoint[];
  color?: string;
}

interface FlightPathsProps {
  tracks: FlightTrack[];
}

export const FlightPaths: React.FC<FlightPathsProps> = ({ tracks }) => {
  return (
    <>
      {tracks.map((track) => {
        const positions: LatLngExpression[] = track.points.map((p) => [p.lat, p.lng]);
        const color = track.color ?? (track.type === 'aircraft' ? '#3b82f6' : '#f59e0b');

        return (
          <Polyline
            key={track.id}
            positions={positions}
            pathOptions={{
              color,
              weight: 2,
              opacity: 0.7,
              dashArray: track.type === 'aircraft' ? '8 4' : undefined,
            }}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <p className="font-semibold text-gray-900">{track.label}</p>
                <p className="text-gray-600 capitalize">{track.type}</p>
                <p className="text-gray-500 text-xs">{track.points.length} track points</p>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
};
