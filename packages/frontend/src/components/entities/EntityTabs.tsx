import React, { useState } from 'react';
import clsx from 'clsx';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface EntityTabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export const EntityTabs: React.FC<EntityTabsProps> = ({ tabs, defaultTab }) => {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '');

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-3 text-base font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="py-4">{activeContent}</div>
    </div>
  );
};
