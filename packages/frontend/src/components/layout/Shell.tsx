import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { useUIStore } from '@/stores/uiStore';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

const notifIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const notifColors = {
  success: 'border-green-500 bg-green-500/10',
  error: 'border-red-500 bg-red-500/10',
  warning: 'border-amber-500 bg-amber-500/10',
  info: 'border-blue-500 bg-blue-500/10',
};

const notifIconColors = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
};

export const Shell: React.FC = () => {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 dark:bg-surface-950 text-gray-100">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        <Footer />
      </div>

      {/* Notification toasts */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
          {notifications.map((notif) => {
            const Icon = notifIcons[notif.type];
            return (
              <div
                key={notif.id}
                className={clsx(
                  'flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-xl',
                  'bg-surface-800',
                  notifColors[notif.type]
                )}
              >
                <Icon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', notifIconColors[notif.type])} />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-gray-100">{notif.title}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{notif.message}</p>
                </div>
                <button
                  onClick={() => removeNotification(notif.id)}
                  className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
