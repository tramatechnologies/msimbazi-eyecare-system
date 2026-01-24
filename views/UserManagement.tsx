/**
 * User Management View
 * Admin-only view for managing system users
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserRole } from '../types';
import { createUser, getAllUsers, updateUserRole, deleteUser, User } from '../services/userService';
import { useToast } from '../components/Toast';
import { exportToPDF, exportToExcel, exportToCSV, ExportData } from '../utils/exportUtils';
import { getCurrentDate } from '../utils/dateTimeUtils';

const UserManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { success: showSuccess, error: showError } = useToast();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: UserRole.RECEPTIONIST,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    const result = await getAllUsers();
    if (result.success && result.users) {
      setUsers(result.users);
    } else {
      showError(result.error || 'Failed to load users');
    }
    setIsLoading(false);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    const result = await createUser({
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: formData.role,
    });

    if (result.success) {
      showSuccess(`User ${formData.name} created successfully`);
      setShowAddForm(false);
      resetForm();
      loadUsers();
    } else {
      showError(result.error || 'Failed to create user');
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: UserRole.RECEPTIONIST,
    });
    setFormErrors({});
    setEditingUser(null);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user ${userName}? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    const result = await deleteUser(userId);
    if (result.success) {
      showSuccess('User deleted successfully');
      loadUsers();
    } else {
      showError(result.error || 'Failed to delete user');
    }
    setIsLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const user = users.find(u => u.id === userId);
    const currentRole = user?.role || '';
    const roleDisplayName = newRole === UserRole.ADMIN ? 'Super Admin' : newRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    if (!confirm(`Are you sure you want to change the role for ${user?.name || user?.email} from ${currentRole} to ${roleDisplayName}? This will immediately update their permissions.`)) {
      return;
    }

    setIsLoading(true);
    const result = await updateUserRole(userId, newRole);
    if (result.success) {
      showSuccess('User role updated successfully');
      loadUsers();
    } else {
      showError(result.error || 'Failed to update role');
    }
    setIsLoading(false);
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter || 
      (roleFilter === 'super_admin' && user.role === 'super_admin');

    return matchesSearch && matchesRole;
  });

  const getRoleDisplayName = (role: string) => {
    if (role === 'super_admin') return 'Super Admin';
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Export functions
  const prepareExportData = (): ExportData => {
    const userRows = filteredUsers.map(user => [
      user.name || 'N/A',
      user.email,
      getRoleDisplayName(user.role),
      user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A',
      user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never',
    ]);

    return {
      title: 'User Management Report',
      summary: [
        { label: 'Total Users', value: filteredUsers.length },
        { label: 'Role Filter', value: roleFilter === 'all' ? 'All Roles' : getRoleDisplayName(roleFilter) },
        { label: 'Generated', value: getCurrentDate() },
      ],
      tables: [{
        title: 'System Users',
        headers: ['Name', 'Email', 'Role', 'Created Date', 'Last Sign In'],
        rows: userRows,
      }],
    };
  };

  const handleExportPDF = async () => {
    if (filteredUsers.length === 0) {
      showError('No users to export');
      return;
    }
    const data = prepareExportData();
    await exportToPDF(data);
    showSuccess('User list exported as PDF');
  };

  const handleExportExcel = () => {
    if (filteredUsers.length === 0) {
      showError('No users to export');
      return;
    }
    const data = prepareExportData();
    exportToExcel(data);
    showSuccess('User list exported as Excel');
  };

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      showError('No users to export');
      return;
    }
    const data = prepareExportData();
    exportToCSV(data);
    showSuccess('User list exported as CSV');
  };

  // Close export menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportMenuOpen]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage system users and permissions</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={filteredUsers.length === 0}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-download"></i>
              Export Users
              <i className={`fas fa-chevron-${exportMenuOpen ? 'up' : 'down'} text-xs`}></i>
            </button>
            
            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => {
                    handleExportPDF();
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3 border-b border-slate-100"
                >
                  <i className="fas fa-file-pdf text-red-600"></i>
                  Export as PDF
                </button>
                <button
                  onClick={() => {
                    handleExportExcel();
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3 border-b border-slate-100"
                >
                  <i className="fas fa-file-excel text-green-600"></i>
                  Export as Excel
                </button>
                <button
                  onClick={() => {
                    handleExportCSV();
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3"
                >
                  <i className="fas fa-file-csv text-blue-600"></i>
                  Export as CSV
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="w-full sm:w-auto px-6 py-3 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            style={{
              background: 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, var(--brand-primary-dark), var(--brand-secondary-dark))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))';
            }}
          >
            <i className="fas fa-user-plus"></i>
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Add User Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Add New User</h2>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none ${
                    formErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Enter Full Name"
                />
                {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none ${
                    formErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Enter Email Address"
                />
                {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none ${
                    formErrors.password ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="••••••••"
                />
                {formErrors.password && <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Confirm Password *</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none ${
                    formErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="••••••••"
                />
                {formErrors.confirmPassword && <p className="text-xs text-red-600 mt-1">{formErrors.confirmPassword}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
                >
                  {Object.values(UserRole).map(role => (
                    <option key={role} value={role}>
                      {role === UserRole.ADMIN ? 'Super Admin' : role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    background: isLoading 
                      ? 'var(--brand-primary)' 
                      : 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.background = 'linear-gradient(to right, var(--brand-primary-dark), var(--brand-secondary-dark))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.background = 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))';
                    }
                  }}
                >
                  {isLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            {Object.values(UserRole).filter(r => r !== UserRole.ADMIN).map(role => (
              <option key={role} value={role.toLowerCase()}>{role.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">System Users ({filteredUsers.length})</h2>
        </div>

        {isLoading && !showAddForm ? (
          <div className="p-12 text-center">
            <i className="fas fa-spinner fa-spin text-2xl text-brand-primary mb-3"></i>
            <p className="text-sm text-slate-500">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fas fa-users text-4xl mb-4 opacity-20"></i>
            <p className="text-base font-semibold text-slate-600 mb-2">No users found</p>
            <p className="text-sm text-slate-500 mb-6">Try adjusting your search or filters, or add a new user</p>
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="px-6 py-3 text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl"
              style={{
                background: 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(to right, var(--brand-primary-dark), var(--brand-secondary-dark))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))';
              }}
            >
              <i className="fas fa-user-plus"></i>
              <span>Add Your First User</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Last Sign In</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white font-bold text-sm">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{user.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700">{user.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role === 'super_admin' ? UserRole.ADMIN : user.role.toUpperCase()}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
                      >
                        {Object.values(UserRole).map(role => (
                          <option key={role} value={role}>
                            {role === UserRole.ADMIN ? 'Super Admin' : role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500">
                        {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Action Button for Mobile */}
      <button
        onClick={() => {
          resetForm();
          setShowAddForm(true);
        }}
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 text-white rounded-full shadow-2xl transition-all flex items-center justify-center z-40"
        style={{
          background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, var(--brand-primary-dark), var(--brand-secondary-dark))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))';
        }}
        aria-label="Add New User"
      >
        <i className="fas fa-user-plus text-xl text-white"></i>
      </button>
    </div>
  );
};

export default UserManagement;
