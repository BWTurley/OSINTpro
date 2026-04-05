import React from 'react';
import { Building2, Globe, MapPin, Users, Calendar, FileText } from 'lucide-react';
import type { Entity } from '@/types';

interface OrgMeta {
  legalName?: string;
  aliases?: string[];
  industry?: string;
  country?: string;
  headquarters?: string;
  website?: string;
  employeeCount?: number;
  foundedDate?: string;
  registrationNumber?: string;
  description?: string;
  subsidiaries?: string[];
  leadership?: { name: string; title: string }[];
}

interface OrgDetailProps {
  entity: Entity;
}

export const OrgDetail: React.FC<OrgDetailProps> = ({ entity }) => {
  const meta = entity.metadata as OrgMeta;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoRow icon={Building2} label="Legal Name" value={meta.legalName ?? entity.label} />
        <InfoRow icon={FileText} label="Industry" value={meta.industry} />
        <InfoRow icon={Globe} label="Country" value={meta.country} />
        <InfoRow icon={MapPin} label="Headquarters" value={meta.headquarters} />
        <InfoRow icon={Globe} label="Website" value={meta.website} />
        <InfoRow icon={Users} label="Employees" value={meta.employeeCount?.toLocaleString()} />
        <InfoRow icon={Calendar} label="Founded" value={meta.foundedDate} />
        <InfoRow icon={FileText} label="Registration" value={meta.registrationNumber} />
      </div>

      {meta.aliases && meta.aliases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Also Known As</h4>
          <div className="flex flex-wrap gap-2">
            {meta.aliases.map((alias) => (
              <span key={alias} className="px-3 py-1 rounded-full text-base bg-surface-800 text-gray-300 border border-gray-700">
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.leadership && meta.leadership.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Leadership</h4>
          <div className="space-y-2">
            {meta.leadership.map((person, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-surface-800/50 border border-gray-700/30">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-base text-gray-200">{person.name}</span>
                <span className="text-sm text-gray-500">-- {person.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {meta.subsidiaries && meta.subsidiaries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Subsidiaries</h4>
          <div className="flex flex-wrap gap-2">
            {meta.subsidiaries.map((sub) => (
              <span key={sub} className="px-3 py-1 rounded-full text-base bg-violet-500/10 text-violet-400 border border-violet-500/30">
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.description && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Description</h4>
          <p className="text-base text-gray-300 leading-relaxed">{meta.description}</p>
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
