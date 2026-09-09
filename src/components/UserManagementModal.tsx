import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';
import { AuthRole, SessionUser } from '../context/AuthContext';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<AuthRole>('user');
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<SessionUser | null>(null);

  const loadUsers = async () => {
    const response = await fetch('/api/users');
    const data = await response.json();
    if (response.ok) setUsers(data.data || []);
    else setError(data.error || 'Unable to load users.');
  };

  useEffect(() => {
    if (isOpen) void loadUsers();
  }, [isOpen]);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const response = await fetch(editingUser ? `/api/users/${editingUser.id}` : '/api/users', {
      method: editingUser ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, password, role }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Unable to create user.');
      return;
    }
    resetForm();
    await loadUsers();
  };

  const resetForm = () => {
    setEditingUser(null);
    setUsername('');
    setDisplayName('');
    setPassword('');
    setShowPassword(false);
    setRole('user');
    setError('');
  };

  const editUser = (item: SessionUser) => {
    setEditingUser(item);
    setUsername(item.username);
    setDisplayName(item.displayName || '');
    setPassword('');
    setRole(item.role === 'admin' ? 'admin' : 'user');
    setError('');
  };

  const deleteUser = async (item: SessionUser) => {
    if (!window.confirm(`Delete user ${item.username}?`)) return;
    setError('');
    const response = await fetch(`/api/users/${item.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Unable to delete user.');
      return;
    }
    if (editingUser?.id === item.id) resetForm();
    await loadUsers();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="modal-panel w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Manage users</h2>
            <p className="text-xs text-slate-500">Create accounts and assign their workspace role.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid min-w-0 gap-6 p-4 sm:p-6 md:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createUser} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{editingUser ? 'Edit account' : 'Create account'}</h3>
              {editingUser && <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-indigo-600">Cancel edit</button>}
            </div>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUser ? 'New password (optional)' : 'Password (8+ characters)'}
                type={showPassword ? 'text' : 'password'}
                minLength={editingUser ? undefined : 8}
                required={!editingUser}
                className="w-full rounded border border-slate-300 px-3 py-2 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-indigo-600"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value as AuthRole)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">{editingUser ? 'Save changes' : 'Create user'}</button>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </form>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Existing accounts</h3>
            <div className="divide-y divide-slate-200 rounded border border-slate-200">
              {users.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{item.displayName || item.username}</span>
                    <span className="block truncate text-xs text-slate-500">{item.username} · {item.role}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => editUser(item)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600" title={`Edit ${item.username}`} aria-label={`Edit ${item.username}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => void deleteUser(item)} className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title={`Delete ${item.username}`} aria-label={`Delete ${item.username}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
