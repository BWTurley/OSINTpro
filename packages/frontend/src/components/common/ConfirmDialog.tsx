import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}) => {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    default: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          {variant !== 'default' && (
            <div
              className={`flex-shrink-0 p-2 rounded-full ${
                variant === 'danger' ? 'bg-red-500/20' : 'bg-amber-500/20'
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${
                  variant === 'danger' ? 'text-red-400' : 'text-amber-400'
                }`}
              />
            </div>
          )}
          <p className="text-base text-gray-300 leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-base font-medium text-gray-300 bg-surface-800
                       hover:bg-surface-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={loading}
            className={`px-4 py-2 text-base font-medium text-white rounded-lg
                       transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
                       focus:ring-offset-surface-900 disabled:opacity-50
                       ${variantClasses[variant]}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
