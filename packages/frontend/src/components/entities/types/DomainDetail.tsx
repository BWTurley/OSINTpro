import React from 'react';
import { Globe, Shield, Clock, FileText, AlertTriangle } from 'lucide-react';
import type { Entity } from '@/types';

interface DomainMeta {
  registrar?: string;
  registrant?: string;
  createdDate?: string;
  expiresDate?: string;
  nameservers?: string[];
  dnsRecords?: { type: string; value: string }[];
  sslIssuer?: string;
  sslExpires?: string;
  sslGrade?: string;
  subdomains?: string[];
  ipAddresses?: string[];
  technologies?: string[];
  threatScore?: number;
  categories?: string[];
}

interface DomainDetailProps {
  entity: Entity;
}

export const DomainDetail: React.FC<DomainDetailProps> = ({ entity }) => {
  const meta = entity.metadata as DomainMeta;

  return (
    <div className="space-y-6">
      {/* Threat Score */}
      {meta.threatScore !== undefined && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-800 border border-gray-700/50">
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

      {/* WHOIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoRow icon={Globe} label="Registrar" value={meta.registrar} />
        <InfoRow icon={FileText} label="Registrant" value={meta.registrant} />
        <InfoRow icon={Clock} label="Created" value={meta.createdDate} />
        <InfoRow icon={Clock} label="Expires" value={meta.expiresDate} />
      </div>

      {/* SSL */}
      {(meta.sslIssuer || meta.sslGrade) && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">SSL Certificate</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoRow icon={Shield} label="Issuer" value={meta.sslIssuer} />
            <InfoRow icon={Clock} label="Expires" value={meta.sslExpires} />
            <InfoRow icon={Shield} label="Grade" value={meta.sslGrade} />
          </div>
        </div>
      )}

      {/* DNS Records */}
      {meta.dnsRecords && meta.dnsRecords.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">DNS Records</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-700/50">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-700/50 bg-surface-800/50">
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-400">Value</th>
                </tr>
              </thead>
              <tbody>
                {meta.dnsRecords.map((rec, i) => (
                  <tr key={i} className="border-b border-gray-700/30">
                    <td className="px-4 py-2 font-mono text-blue-400">{rec.type}</td>
                    <td className="px-4 py-2 font-mono text-gray-200">{rec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subdomains */}
      {meta.subdomains && meta.subdomains.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Subdomains ({meta.subdomains.length})</h4>
          <div className="flex flex-wrap gap-2">
            {meta.subdomains.map((sub) => (
              <span key={sub} className="px-3 py-1 rounded-full text-sm font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* IP Addresses */}
      {meta.ipAddresses && meta.ipAddresses.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">IP Addresses</h4>
          <div className="flex flex-wrap gap-2">
            {meta.ipAddresses.map((ip) => (
              <span key={ip} className="px-3 py-1 rounded-full text-sm font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {ip}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Technologies */}
      {meta.technologies && meta.technologies.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Technologies</h4>
          <div className="flex flex-wrap gap-2">
            {meta.technologies.map((tech) => (
              <span key={tech} className="px-3 py-1 rounded-full text-sm bg-surface-800 text-gray-300 border border-gray-700">
                {tech}
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
