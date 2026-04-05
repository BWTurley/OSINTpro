import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Network,
  Map,
  ShieldAlert,
  Download,
  Search,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '@/stores/uiStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/cases', icon: FolderOpen, label: 'Cases' },
  { to: '/graph', icon: Network, label: 'Graph' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/threats', icon: ShieldAlert, label: 'Threats' },
  { to: '/collection', icon: Download, label: 'Collection' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/admin', icon: Settings, label: 'Admin' },
];

export const Sidebar: React.FC = () => {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-surface-900 border-r border-gray-700/50 transition-all duration-300',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Logo area */}
      <div className="flex items-center h-16 px-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Network className="h-5 w-5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="text-lg font-bold text-gray-100 whitespace-nowrap">
              OSINT Hub
            </span>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors',
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-surface-800'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-gray-700/50">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full p-2 rounded-lg text-gray-400
                     hover:text-gray-200 hover:bg-surface-800 transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>
    </aside>
  );
};
