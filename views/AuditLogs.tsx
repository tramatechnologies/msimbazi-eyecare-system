/**
 * Audit Logs View
 * Admin-only view for system audit trail
 */

import React, { useState } from 'react';

const AuditLogs: React.FC = () => {
  const [filters, setFilters] = useState({
    action: 'all',
    user: 'all',
    dateRange: 'today',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">System activity and security audit trail</p>
        </div>
        <button className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold text-sm hover:bg-brand-primary-dark transition-all flex items-center gap-2">
          <i className="fas fa-download"></i>
          Export Logs
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Action Type</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({...filters, action: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
            >
              <option value="all">All Actions</option>
              <option value="login">Login</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">User</label>
            <select
              value={filters.user}
              onChange={(e) => setFilters({...filters, user: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
            >
              <option value="all">All Users</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Activity Log</h2>
        </div>
        <div className="p-8 text-center text-slate-400">
          <i className="fas fa-history text-3xl mb-3 opacity-20"></i>
          <p className="text-sm font-semibold text-slate-600 mb-1">Audit logs coming soon</p>
          <p className="text-xs text-slate-500">System activity will be logged here for security and compliance</p>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
