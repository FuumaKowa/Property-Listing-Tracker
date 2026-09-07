import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
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
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, password, role }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Unable to create user.');
      return;
    }
    setUsername('');
    setDisplayName('');
    setPassword('');
    setShowPassword(false);
    setRole('user');
    await loadUsers();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Manage users</h2>
            <p className="text-xs text-slate-500">Create accounts and assign their workspace role.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createUser} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Create account</h3>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (8+ characters)"
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                required
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
            <button className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create user</button>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </form>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Existing accounts</h3>
            <div className="divide-y divide-slate-200 rounded border border-slate-200">
              {users.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{item.displayName || item.username}</span>
                  <span className="text-xs uppercase text-slate-500">{item.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
