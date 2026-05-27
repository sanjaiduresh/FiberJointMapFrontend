import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { TeamMember } from '../types';
import { API_BASE } from '../config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, Plus, Trash2, Loader2, X, Shield, UserCircle, Mail, Eye, EyeOff,
} from 'lucide-react';

const API_URL = `${API_BASE}/api/users`;

interface TeamManagementProps {
  open: boolean;
  onClose: () => void;
}

export default function TeamManagement({ open, onClose }: TeamManagementProps) {
  const { token } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch team');
      const data: TeamMember[] = await res.json();
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, fetchMembers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newName || !newEmail || !newPassword) {
      setError('All fields are required');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: 'EMPLOYEE' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }
      const newMember: TeamMember = await res.json();
      setMembers((prev) => [newMember, ...prev]);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your team? They will no longer be able to access the app.`)) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove');
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // silently fail
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Team Management</h2>
              <p className="text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-muted/50 border border-border rounded-xl px-4 py-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={m.role === 'OWNER' ? 'default' : 'secondary'}
                      className="text-[10px] h-5 gap-1"
                    >
                      {m.role === 'OWNER' ? (
                        <Shield className="size-2.5" />
                      ) : (
                        <UserCircle className="size-2.5" />
                      )}
                      {m.role}
                    </Badge>
                    {m.role !== 'OWNER' && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(m.id, m.name)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Add Form */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                Add Employee
              </p>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-1.5">{error}</p>
              )}

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Employee name"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block flex items-center gap-1">
                  <Mail className="size-3" /> Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="employee@company.com"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set a password"
                    className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAddForm(false); setError(null); }}
                  disabled={addLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={addLoading} className="gap-1">
                  {addLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Add Employee
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!showAddForm && (
          <div className="px-6 py-3 border-t border-border">
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full gap-2"
              size="sm"
            >
              <Plus className="size-4" />
              Add Employee
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
