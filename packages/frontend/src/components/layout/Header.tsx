import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Moon, Sun, LogOut, User, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useSearch } from '@/hooks/useSearch';
import { entityTypeLabel } from '@/utils/formatters';
import { ENTITY_BG_CLASSES } from '@/utils/constants';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme, notifications } = useUIStore();
  const { user, logout } = useAuthStore();
  const { query, setQuery, suggestions } = useSearch(250);

  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const unreadCount = notifications.length;

  return (
    <header className="flex items-center h-16 px-6 bg-surface-900 border-b border-gray-700/50 gap-4">
      {/* Global search */}
      <div ref={searchRef} className="relative flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                navigate(`/search?q=${encodeURIComponent(query)}`);
                setSearchFocused(false);
              }
            }}
            placeholder="Search entities, cases, IOCs..."
            className="w-full pl-10 pr-4 py-2.5 text-base bg-surface-800 border border-gray-700
                       rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                       focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* Search suggestions dropdown */}
        {searchFocused && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-800 border border-gray-700
                          rounded-lg shadow-xl z-50 overflow-hidden">
            {suggestions.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => {
                  navigate(`/search?q=${encodeURIComponent(entity.value)}`);
                  setSearchFocused(false);
                  setQuery('');
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-surface-700
                           transition-colors border-b border-gray-700/30 last:border-b-0"
              >
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    ENTITY_BG_CLASSES[entity.type]
                  )}
                >
                  {entityTypeLabel(entity.type)}
                </span>
                <span className="text-base text-gray-200 truncate">{entity.value}</span>
                <span className="ml-auto text-sm text-gray-500">{entity.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notification bell */}
        <button
          className="relative p-2.5 rounded-lg text-gray-400 hover:text-gray-200
                     hover:bg-surface-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px]
                             h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300
                       hover:bg-surface-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            {user && <span className="text-base font-medium hidden md:inline">{user.name}</span>}
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface-800 border border-gray-700
                            rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700/50">
                <p className="text-base font-medium text-gray-200">{user?.name ?? 'User'}</p>
                <p className="text-sm text-gray-500">{user?.email ?? ''}</p>
              </div>
              <button
                onClick={() => {
                  logout();
                  setUserMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-3 text-base text-gray-300
                           hover:bg-surface-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
