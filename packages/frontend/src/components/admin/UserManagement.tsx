import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, UserCheck } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDateTime } from '@/utils/formatters';
import clsx from 'clsx';
import type { User } from '@/types';

const roleColors: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400',
  analyst: 'bg-blue-500/20 text-blue-400',
  viewer: 'bg-gray-500/20 text-gray-400',
};

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
    })
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch((err) => console.error('Failed to load users:', err));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base text-gray-400">{users.length} users</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* User table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-gray-700/50 bg-surface-800/50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">User</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Role</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Last Login</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Created</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-700/30 hover:bg-surface-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center">
                      <UserCheck className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-200">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('badge text-xs capitalize', roleColors[user.role])}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{formatDateTime(user.lastLogin)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(user.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-surface-700 rounded-lg transition-colors">
                      <Shield className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-surface-700 rounded-lg transition-colors">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(user.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create user modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add User" size="md">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-base font-medium text-gray-300">Name</label>
            <input type="text" placeholder="Full name" className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="block text-base font-medium text-gray-300">Email</label>
            <input type="email" placeholder="user@example.com" className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="block text-base font-medium text-gray-300">Role</label>
            <select className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="viewer">Viewer</option>
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-base text-gray-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">Cancel</button>
            <button className="px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Add User</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => setDeleteTarget(null)}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};
