import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';
import { LogOut, Users, Building, Plus, Trash2, KeyRound, Loader2, RefreshCw, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const API_URL = `${API_BASE}/api/admin`;

interface Organization {
  _id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'organizations' | 'users'>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<string | null>(null);

  // Forms
  const [orgForm, setOrgForm] = useState({ orgName: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE', organizationId: '' });
  const [newPassword, setNewPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  // Edit states
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editOrgForm, setEditOrgForm] = useState({ orgName: '' });

  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', role: 'EMPLOYEE', organizationId: '' });
  const [editUserOrgSearch, setEditUserOrgSearch] = useState('');
  const [editUserOrgDropdownOpen, setEditUserOrgDropdownOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [orgsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/organizations`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!orgsRes.ok || !usersRes.ok) throw new Error('Failed to fetch data');
      const orgsData = await orgsRes.json();
      const usersData = await usersRes.json();
      setOrganizations(orgsData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDashboardData();
  }, [token]);

  // Handlers
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(orgForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create organization');
      setShowOrgModal(false);
      setOrgForm({ orgName: '' });
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setShowUserModal(false);
      setUserForm({ name: '', email: '', password: '', role: 'EMPLOYEE', organizationId: '' });
      setOrgSearch('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete user');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal) return;
    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/${showPasswordModal}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error('Failed to reset password');
      setShowPasswordModal(null);
      setNewPassword('');
      alert('Password reset successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditOrgClick = (org: Organization) => {
    setEditingOrg(org);
    setEditOrgForm({ orgName: org.name });
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/organizations/${editingOrg._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editOrgForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update organization');
      setEditingOrg(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUserClick = (u: UserData) => {
    setEditingUser(u);
    setEditUserForm({
      name: u.name,
      email: u.email,
      role: u.role,
      organizationId: u.organizationId || '',
    });
    const org = organizations.find(o => o._id === u.organizationId);
    setEditUserOrgSearch(org ? org.name : '');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editUserForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      setEditingUser(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Super Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage organizations and users across the platform</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{user?.name}</p>
            <p className="text-[11px] text-muted-foreground leading-none mb-1">{user?.email}</p>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
              ADMIN
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-6 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-border pb-px">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'organizations' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building className="size-4 inline-block mr-2" />
            Organizations
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'users' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="size-4 inline-block mr-2" />
            All Users
          </button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="size-3.5 mr-2" /> Refresh
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'organizations' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-lg">Organizations ({organizations.length})</h2>
              <Button onClick={() => setShowOrgModal(true)} size="sm">
                <Plus className="size-4 mr-1.5" /> Add Organization
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Organization Name</th>
                    <th className="px-4 py-3">Created At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {organizations.map(org => (
                    <tr key={org._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{org._id}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{org.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(org.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleEditOrgClick(org)} className="text-muted-foreground hover:bg-muted">
                          <Edit3 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {organizations.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No organizations found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-lg">Users ({users.length})</h2>
              <Button onClick={() => setShowUserModal(true)} size="sm">
                <Plus className="size-4 mr-1.5" /> Add User
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Organization ID</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(u => (
                    <tr key={u._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={u.role === 'OWNER' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.organizationId || '-'}</td>
                      <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleEditUserClick(u)} className="text-muted-foreground hover:bg-muted">
                          <Edit3 className="size-4" />
                        </Button>
                        <Button variant="secondary" size="xs" onClick={() => setShowPasswordModal(u._id)} className="h-7 text-xs">
                          <KeyRound className="size-3 mr-1" /> Reset Pwd
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteUser(u._id)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* --- Modals --- */}
      <Dialog open={showOrgModal} onOpenChange={setShowOrgModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrg} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label>Organization Name</Label>
              <Input required value={orgForm.orgName} onChange={e => setOrgForm({ orgName: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOrgModal(false)}>Cancel</Button>
              <Button type="submit" disabled={formLoading}>{formLoading ? 'Creating...' : 'Create Organization'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input required value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Password</Label>
              <Input required type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={userForm.role} 
                onChange={e => setUserForm({ ...userForm, role: e.target.value })}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <div className="grid gap-1.5 relative">
              <Label>Organization</Label>
              <Input 
                required 
                placeholder="Search Organization..." 
                value={orgSearch} 
                onChange={e => {
                  setOrgSearch(e.target.value);
                  setUserForm({ ...userForm, organizationId: '' });
                  setOrgDropdownOpen(true);
                }}
                onFocus={() => setOrgDropdownOpen(true)}
              />
              {orgDropdownOpen && (
                <div className="absolute top-[100%] left-0 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                  {organizations.filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase())).length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">No organizations found</div>
                  ) : (
                    organizations.filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase())).map(org => (
                      <div 
                        key={org._id}
                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setUserForm({ ...userForm, organizationId: org._id });
                          setOrgSearch(org.name);
                          setOrgDropdownOpen(false);
                        }}
                      >
                        {org.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowUserModal(false)}>Cancel</Button>
              <Button type="submit" disabled={formLoading}>{formLoading ? 'Creating...' : 'Add User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPasswordModal} onOpenChange={(open) => !open && setShowPasswordModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label>New Password</Label>
              <Input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPasswordModal(null)}>Cancel</Button>
              <Button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Reset Password'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Modal */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateOrg} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label>Organization Name</Label>
              <Input required value={editOrgForm.orgName} onChange={e => setEditOrgForm({ orgName: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingOrg(null)}>Cancel</Button>
              <Button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input required value={editUserForm.name} onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input required type="email" value={editUserForm.email} onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editUserForm.role} 
                onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <div className="grid gap-1.5 relative">
              <Label>Organization</Label>
              <Input 
                required 
                placeholder="Search Organization..." 
                value={editUserOrgSearch} 
                onChange={e => {
                  setEditUserOrgSearch(e.target.value);
                  setEditUserForm({ ...editUserForm, organizationId: '' });
                  setEditUserOrgDropdownOpen(true);
                }}
                onFocus={() => setEditUserOrgDropdownOpen(true)}
              />
              {editUserOrgDropdownOpen && (
                <div className="absolute top-[100%] left-0 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                  {organizations.filter(o => o.name.toLowerCase().includes(editUserOrgSearch.toLowerCase())).length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">No organizations found</div>
                  ) : (
                    organizations.filter(o => o.name.toLowerCase().includes(editUserOrgSearch.toLowerCase())).map(org => (
                      <div 
                        key={org._id}
                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setEditUserForm({ ...editUserForm, organizationId: org._id });
                          setEditUserOrgSearch(org.name);
                          setEditUserOrgDropdownOpen(false);
                        }}
                      >
                        {org.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
