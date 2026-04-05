import React from 'react';
import { Server, Globe, MapPin, AlertTriangle, Wifi } from 'lucide-react';
import type { Entity } from '@/types';

interface IPMeta {
  asn?: string;
  asnOrg?: string;
  isp?: string;
  country?: string;
  city?: string;
  lat?: number;
  lng?: number;
  openPorts?: { port: number; protocol: string; service: string; version?: string }[];
  threatScore?: number;
  malwareAssociated?: boolean;
  botnet?: boolean;
  tor?: boolean;
  proxy?: boolean;
  vpn?: boolean;
  reverseHostnames?: string[];
  tags?: string[];
}

interface IPDetailProps {
  entity: Entity;
}

export const IPDetail: React.FC<IPDetailProps> = ({ entity }) => {
  const meta = entity.metadata as IPMeta;

  return (
    <div className="space-y-6">
      {/* Threat Score & Flags */}
      <div className="flex items-center gap-4 flex-wrap">
        {meta.threatScore !== undefined && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-800 border border-gray-700/50">
            <AlertTriangle
              className={`h-8 w-8 ${
                meta.threatScore >= 80
                  ? 'text-red-400'
                  : meta.threatScore >= 50
                  ? 'text-amber-400'
                  : 'text-green-400'
              }`}
            />
            <div>
              <p className="text-sm text-gray-400">Threat Score</p>
              <p className="text-2xl font-bold text-gray-100">{meta.threatScore}/100</p>
            </div>
          </div>
        )}

        {/* Boolean flags */}
        <div className="flex flex-wrap gap-2">
          {meta.tor && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
              TOR Exit Node
            </span>
          )}
          {meta.proxy && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Proxy
            </span>
          )}
          {meta.vpn && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
              VPN
            </span>
          )}
          {meta.botnet && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
              Botnet
            </span>
          )}
          {meta.malwareAssociated && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600/20 text-red-500 border border-red-600/30">
              Malware Associated
            </span>
          )}
        </div>
      </div>

      {/* Geolocation & Network */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoRow icon={Server} label="ASN" value={meta.asn} />
        <InfoRow icon={Globe} label="ASN Organization" value={meta.asnOrg} />
        <InfoRow icon={Wifi} label="ISP" value={meta.isp} />
        <InfoRow icon={MapPin} label="Country" value={meta.country} />
        <InfoRow icon={MapPin} label="City" value={meta.city} />
        {meta.lat !== undefined && meta.lng !== undefined && (
          <InfoRow icon={MapPin} label="Coordinates" value={`${meta.lat}, ${meta.lng}`} />
        )}
      </div>

      {/* Open Ports */}
      {meta.openPorts && meta.openPorts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Open Ports ({meta.openPorts.length})</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-700/50">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-700/50 bg-surface-800/50">
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-400">Port</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-400">Protocol</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-400">Service</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-400">Version</th>
                </tr>
              </thead>
              <tbody>
                {meta.openPorts.map((port, i) => (
                  <tr key={i} className="border-b border-gray-700/30">
                    <td className="px-4 py-2 font-mono text-amber-400">{port.port}</td>
                    <td className="px-4 py-2 text-gray-300 uppercase">{port.protocol}</td>
                    <td className="px-4 py-2 text-gray-200">{port.service}</td>
                    <td className="px-4 py-2 text-gray-400">{port.version ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reverse Hostnames */}
      {meta.reverseHostnames && meta.reverseHostnames.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Reverse DNS</h4>
          <div className="flex flex-wrap gap-2">
            {meta.reverseHostnames.map((hostname) => (
              <span key={hostname} className="px-3 py-1 rounded-full text-sm font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {hostname}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-800/50 border border-gray-700/30">
      <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-base text-gray-200">{value}</p>
      </div>
    </div>
  );
}
