import React from 'react';
import { User, MapPin, Briefcase, Calendar, Globe, Mail, Phone } from 'lucide-react';
import type { Entity } from '@/types';

interface PersonDetailProps {
  entity: Entity;
}

interface PersonMeta {
  fullName?: string;
  aliases?: string[];
  dateOfBirth?: string;
  nationality?: string;
  occupation?: string;
  employer?: string;
  address?: string;
  email?: string;
  phone?: string;
  socialMedia?: Record<string, string>;
  photo?: string;
  description?: string;
}

export const PersonDetail: React.FC<PersonDetailProps> = ({ entity }) => {
  const meta = entity.metadata as PersonMeta;

  return (
    <div className="space-y-6">
      {/* Primary info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoRow icon={User} label="Full Name" value={meta.fullName ?? entity.label} />
        <InfoRow icon={Calendar} label="Date of Birth" value={meta.dateOfBirth} />
        <InfoRow icon={Globe} label="Nationality" value={meta.nationality} />
        <InfoRow icon={Briefcase} label="Occupation" value={meta.occupation} />
        <InfoRow icon={Briefcase} label="Employer" value={meta.employer} />
        <InfoRow icon={MapPin} label="Address" value={meta.address} />
        <InfoRow icon={Mail} label="Email" value={meta.email} />
        <InfoRow icon={Phone} label="Phone" value={meta.phone} />
      </div>

      {/* Aliases */}
      {meta.aliases && meta.aliases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Aliases</h4>
          <div className="flex flex-wrap gap-2">
            {meta.aliases.map((alias) => (
              <span key={alias} className="px-3 py-1 rounded-full text-base bg-surface-800 text-gray-300 border border-gray-700">
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Social Media */}
      {meta.socialMedia && Object.keys(meta.socialMedia).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-gray-300">Social Media</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(meta.socialMedia).map(([platform, handle]) => (
              <div key={platform} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-surface-800/50 border border-gray-700/30">
                <span className="text-sm font-medium text-gray-400 capitalize w-24">{platform}</span>
                <span className="text-base text-blue-400">{handle}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
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
