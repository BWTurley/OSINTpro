import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Search, ExternalLink, ShieldAlert } from 'lucide-react';
import { GET_THREAT_FEED } from '@/graphql/queries/search';
import { SEVERITY_BG_CLASSES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import clsx from 'clsx';
import type { CVEEntry, Severity } from '@/types';

const severityFilters: Severity[] = ['critical', 'high', 'medium', 'low'];

function cvssColor(score: number): string {
  if (score >= 9.0) return 'text-red-400 bg-red-500/20';
  if (score >= 7.0) return 'text-orange-400 bg-orange-500/20';
  if (score >= 4.0) return 'text-yellow-400 bg-yellow-500/20';
  return 'text-green-400 bg-green-500/20';
}

export const CVEMonitor: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity[]>([]);

  const { data } = useQuery(GET_THREAT_FEED, {
    variables: { limit: 50, types: ['VULNERABILITY'] },
  });

  const cves: CVEEntry[] = (data?.threatFeed ?? []).map((item: Record<string, unknown>) => {
    const score = (item.threatScore as number) ?? 0;
    const severity: Severity = score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low';
    return {
      id: item.id as string,
      cveId: item.value as string,
      description: '',
      cvssScore: score,
      severity,
      exploitAvailable: false,
      cisaKev: false,
      publishedAt: item.firstSeen as string,
      updatedAt: item.lastSeen as string,
    };
  });

  const filtered = cves.filter((cve) => {
    if (severityFilter.length > 0 && !severityFilter.includes(cve.severity)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        cve.cveId.toLowerCase().includes(q) ||
        cve.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSeverity = (sev: Severity) => {
    setSeverityFilter((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  };

  return (
    <div className="space-y-5">
      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search CVE ID, keyword, vendor..."
            className="w-full pl-10 pr-4 py-2.5 text-base bg-surface-800 border border-gray-700
                       rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                       focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5">
          {severityFilters.map((sev) => (
            <button
              key={sev}
              onClick={() => toggleSeverity(sev)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize',
                severityFilter.includes(sev)
                  ? SEVERITY_BG_CLASSES[sev] + ' border-current'
                  : 'bg-surface-800 text-gray-400 border-gray-700/50 hover:text-gray-200'
              )}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* CVE cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
          <ShieldAlert className="h-10 w-10" />
          <p className="text-base">No CVEs match your search</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cve) => (
            <div
              key={cve.id}
              className="flex flex-col gap-3 p-5 rounded-xl bg-surface-800/50 border border-gray-700/30
                         hover:bg-surface-800 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2.5 py-1 rounded text-xs font-bold', cvssColor(cve.cvssScore))}>
                    CVSS {cve.cvssScore}
                  </span>
                  <span className={clsx('badge text-xs capitalize', SEVERITY_BG_CLASSES[cve.severity])}>
                    {cve.severity}
                  </span>
                </div>
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-blue-400 transition-colors"
                  aria-label="View on NVD"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <div>
                <p className="text-base font-semibold text-gray-200 font-mono">{cve.cveId}</p>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{cve.description}</p>
              </div>

              <div className="flex items-center gap-2 mt-auto">
                {cve.exploitAvailable && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded">
                    Exploit Available
                  </span>
                )}
                {cve.cisaKev && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
                    CISA KEV
                  </span>
                )}
                <span className="text-xs text-gray-500 ml-auto">{formatDate(cve.publishedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
