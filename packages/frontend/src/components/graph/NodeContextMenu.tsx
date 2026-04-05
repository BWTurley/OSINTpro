import React, { useEffect, useRef } from 'react';
import {
  Expand,
  EyeOff,
  Pin,
  Search,
  FolderPlus,
  Unlink,
} from 'lucide-react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onAction: (action: string) => void;
  onClose: () => void;
}

const menuItems = [
  { action: 'expand', label: 'Expand Relationships', icon: Expand },
  { action: 'select-neighbors', label: 'Select Neighbors', icon: Search },
  { action: 'pin', label: 'Pin Node', icon: Pin },
  { action: 'hide', label: 'Hide Node', icon: EyeOff },
  { action: 'investigate', label: 'Investigate', icon: Search },
  { action: 'add-to-case', label: 'Add to Case', icon: FolderPlus },
  { action: 'remove-edges', label: 'Remove Edges', icon: Unlink },
];

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x,
  y,
  nodeId: _nodeId,
  onAction,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 min-w-[200px] bg-surface-800 border border-gray-700 rounded-lg
                 shadow-xl overflow-hidden"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item) => (
        <button
          key={item.action}
          onClick={() => onAction(item.action)}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-base text-gray-300
                     hover:bg-surface-700 hover:text-gray-100 transition-colors"
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  );
};
