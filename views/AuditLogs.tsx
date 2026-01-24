/**
 * Audit Logs View
 * Admin-only view for system audit trail
 */

import React, { useState, useRef, useEffect } from 'react';
import { exportToPDF, exportToExcel, exportToCSV, ExportData } from '../utils/exportUtils';
import { formatDate, formatTime, getCurrentDate } from '../utils/dateTimeUtils';
import { getAuditLogs, getAuditLogUsers, AuditLog } from '../services/auditService';
import { useToast } from '../components/Toast';

const AuditLogs: React.FC = () => {
  const [filters, setFilters] = useState({
    action: 'all',
    user: 'all',
    dateRange: 'today',
  });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { error: showError } = useToast();

  // Load audit logs
  useEffect(() => {
    loadAuditLogs();
    loadUsers();
  }, [filters]);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const auditLogs = await getAuditLogs(filters);
      setLogs(auditLogs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      showError('Failed to load audit logs');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const userList = await getAuditLogUsers();
      setUsers(userList);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleExportPDF = async () => {
    const data: ExportData = {
      title: 'Audit Logs',
      period: filters.dateRange,
      summary: [
        { label: 'Action Filter', value: filters.action },
        { label: 'User Filter', value: filters.user },
        { label: 'Date Range', value: filters.dateRange },
        { label: 'Total Entries', value: logs.length },
      ],
      tables: [{
        title: 'Audit Log Entries',
        headers: ['Date & Time', 'User', 'Action', 'Entity Type', 'IP Address', 'Status'],
        rows: logs.map(log => [
          `${formatDate(log.timestamp)} ${formatTime(log.timestamp)}`,
          log.user_name || log.user_email || 'Unknown',
          log.action,
          log.entity_type || 'N/A',
          log.ip_address || 'N/A',
          log.status || 'SUCCESS',
        ]),
      }],
    };
    await exportToPDF(data);
    setExportMenuOpen(false);
  };

  const handleExportExcel = () => {
    const data: ExportData = {
      title: 'Audit Logs',
      period: filters.dateRange,
      summary: [
        { label: 'Action Filter', value: filters.action },
        { label: 'User Filter', value: filters.user },
        { label: 'Date Range', value: filters.dateRange },
        { label: 'Total Entries', value: logs.length },
      ],
      tables: [{
        title: 'Audit Log Entries',
        headers: ['Date & Time', 'User', 'Action', 'Entity Type', 'IP Address', 'Status'],
        rows: logs.map(log => [
          `${formatDate(log.timestamp)} ${formatTime(log.timestamp)}`,
          log.user_name || log.user_email || 'Unknown',
          log.action,
          log.entity_type || 'N/A',
          log.ip_address || 'N/A',
          log.status || 'SUCCESS',
        ]),
      }],
    };
    exportToExcel(data);
    setExportMenuOpen(false);
  };

  const handleExportCSV = () => {
    const data: ExportData = {
      title: 'Audit Logs',
      period: filters.dateRange,
      summary: [
        { label: 'Action Filter', value: filters.action },
        { label: 'User Filter', value: filters.user },
        { label: 'Date Range', value: filters.dateRange },
        { label: 'Total Entries', value: logs.length },
      ],
      tables: [{
        title: 'Audit Log Entries',
        headers: ['Date & Time', 'User', 'Action', 'Entity Type', 'IP Address', 'Status'],
        rows: logs.map(log => [
          `${formatDate(log.timestamp)} ${formatTime(log.timestamp)}`,
          log.user_name || log.user_email || 'Unknown',
          log.action,
          log.entity_type || 'N/A',
          log.ip_address || 'N/A',
          log.status || 'SUCCESS',
        ]),
      }],
    };
    exportToCSV(data);
    setExportMenuOpen(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">System activity and security audit trail</p>
        </div>
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="px-6 py-3 text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-2"
            style={{ backgroundColor: 'var(--brand-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
            }}
          >
            <i className="fas fa-download"></i>
            Export Logs
            <i className={`fas fa-chevron-${exportMenuOpen ? 'up' : 'down'} text-xs`}></i>
          </button>
          
          {exportMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
              <button
                onClick={handleExportPDF}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3 border-b border-slate-100"
              >
                <i className="fas fa-file-pdf text-red-600"></i>
                Export as PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3 border-b border-slate-100"
              >
                <i className="fas fa-file-excel text-green-600"></i>
                Export as Excel
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3"
              >
                <i className="fas fa-file-csv text-blue-600"></i>
                Export as CSV
              </button>
            </div>
          )}
        </div>
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
              <option value="LOGIN">Login</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="NHIF">NHIF Operations</option>
              <option value="PAYMENT">Payment Processing</option>
              <option value="USER">User Management</option>
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
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
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
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Activity Log ({logs.length} entries)</h2>
          <button
            onClick={loadAuditLogs}
            className="px-4 py-2 text-sm text-brand-primary hover:text-brand-primary-dark font-semibold transition-colors"
          >
            <i className="fas fa-sync-alt mr-2"></i>Refresh
          </button>
        </div>
        
        {isLoading ? (
          <div className="p-12 text-center">
            <i className="fas fa-spinner fa-spin text-2xl text-brand-primary mb-3"></i>
            <p className="text-sm text-slate-500">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <i className="fas fa-history text-3xl mb-3 opacity-20"></i>
            <p className="text-sm font-semibold text-slate-600 mb-1">No audit logs found</p>
            <p className="text-xs text-slate-500">No activity matches the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">User</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Entity Type</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isCritical = log.action.includes('DELETE') || 
                                   log.action.includes('CREATE_USER') || 
                                   log.action.includes('UPDATE_ROLE') ||
                                   log.action.includes('NHIF') ||
                                   log.action.includes('PAYMENT');
                  
                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-slate-50 transition-colors ${
                        isCritical ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-normal text-slate-900">
                          {formatDate(log.timestamp)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatTime(log.timestamp)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-normal text-slate-900">
                          {log.user_name || 'Unknown User'}
                        </div>
                        {log.user_email && (
                          <div className="text-xs text-slate-500">
                            {log.user_email}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          isCritical 
                            ? 'bg-red-100 text-red-700' 
                            : log.action.includes('CREATE') || log.action.includes('LOGIN')
                            ? 'bg-green-100 text-green-700'
                            : log.action.includes('UPDATE')
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-normal text-slate-700">
                          {log.entity_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-normal text-slate-600">
                          {log.ip_address || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          log.status === 'SUCCESS' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {log.status || 'SUCCESS'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
