'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { listImpersonatableUsers } from '@/lib/actions/impersonation';
import type { ImpersonatableUserDTO } from '@/lib/types';
import { Search, UserCheck, LogOut, CheckCircle, AlertCircle, Shield } from 'lucide-react';

// The action already filters out super_admins server-side.
type User = ImpersonatableUserDTO;

export default function ImpersonatePage() {
  const { hasRole, impersonateUser, exitImpersonation, isImpersonating, impersonatedByUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is super_admin
  const isSuperAdmin = hasRole('super_admin');

  useEffect(() => {
    if (isSuperAdmin && !isImpersonating) {
      fetchUsers();
    }
  }, [isSuperAdmin, isImpersonating]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const result = await listImpersonatableUsers();
      if (!result.success) throw new Error(result.error);
      setUsers(result.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await impersonateUser(selectedUserId, reason);
      if (result.success) {
        setMessage({ type: 'success', text: 'Impersonation started successfully' });
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to start impersonation' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to start impersonation' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExitImpersonation = async () => {
    const result = await exitImpersonation();
    if (result.success) {
      window.location.reload();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to exit impersonation' });
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isImpersonating) {
    return (
      <div className="space-y-6">
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-warning" />
            <h2 className="text-lg font-semibold text-warning">Impersonation Mode Active</h2>
          </div>
          <p className="text-warning mb-4">
            You are currently viewing the system as <strong>{impersonatedByUser?.full_name || 'Unknown'}</strong>.
          </p>
          <button
            onClick={handleExitImpersonation}
            className="flex items-center gap-2 px-4 py-2 bg-warning text-warning-foreground rounded-lg hover:bg-warning/90 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Exit Impersonation
          </button>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Impersonate User</h1>
          <p className="text-muted-foreground mt-1">View the system as another user</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6">
          <p className="text-destructive">Access denied. Only super admins can impersonate users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Impersonate User</h1>
        <p className="text-muted-foreground mt-1">View the system as another user (Super Admin only)</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <AlertCircle className="h-5 w-5 text-destructive" />
          )}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-success' : 'text-destructive'
          }`}>{message.text}</p>
        </div>
      )}

      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">Security Notice</p>
            <p className="text-sm text-warning mt-1">
              All impersonation sessions are logged. You will see a banner indicating you are in impersonation mode.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleImpersonate} className="space-y-6">
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Select User</label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Choose a user...</option>
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email ?? 'no email'}) - {user.role.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Reason *</label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Why are you impersonating this user?"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="bg-card rounded-lg border border-border shadow-sm p-8 text-center text-muted-foreground">
            Loading users...
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No users found</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-muted">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{user.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{user.email ?? '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                          user.role === 'admin' ? 'bg-info/10 text-info' :
                          user.role === 'fleet_dispatch' ? 'bg-success/10 text-success' :
                          'bg-muted text-foreground'
                        }`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                        >
                          <UserCheck className="h-4 w-4" />
                          Impersonate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedUserId || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <UserCheck className="h-4 w-4" />
            {isSubmitting ? 'Starting...' : 'Start Impersonation'}
          </button>
        </div>
      </form>
    </div>
  );
}
