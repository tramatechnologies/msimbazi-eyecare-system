/**
 * Performance Reports View
 * Admin and Manager view for role-specific user performance reports
 */

import React, { useState, useMemo, useRef } from 'react';
import { usePatients } from '../contexts/PatientContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { getAllUsers, User } from '../services/userService';
import { 
  getPerformanceCalculator,
  UserPerformance,
  calculateReceptionistPerformance,
  calculateOptometristPerformance,
  calculatePharmacistPerformance,
  calculateOpticalDispenserPerformance,
  calculateBillingOfficerPerformance,
  calculateManagerPerformance,
} from '../utils/performanceUtils';
import { exportToPDF, exportToExcel, exportToCSV, ExportData, formatCurrency } from '../utils/exportUtils';
import { formatDate, getCurrentDate } from '../utils/dateTimeUtils';
import { useToast } from '../components/Toast';

type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

const PerformanceReports: React.FC = () => {
  const { patients } = usePatients();
  const { activeRole } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('today');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Load users on mount
  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    const result = await getAllUsers();
    if (result.success && result.users) {
      setUsers(result.users);
    }
    setIsLoading(false);
  };

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (selectedPeriod) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
    }

    return { startDate, endDate: now };
  }, [selectedPeriod]);

  // Filter users by role
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    if (selectedRole !== 'all') {
      filtered = filtered.filter(u => {
        const userRole = u.role === 'super_admin' ? 'ADMIN' : u.role.toUpperCase();
        return userRole === selectedRole;
      });
    }

    if (selectedUserId !== 'all') {
      filtered = filtered.filter(u => u.id === selectedUserId);
    }

    return filtered;
  }, [users, selectedRole, selectedUserId]);

  // Calculate performance for each user
  const userPerformances = useMemo(() => {
    return filteredUsers.map(user => {
      const userRole = user.role === 'super_admin' ? UserRole.ADMIN : 
                      user.role.toUpperCase() as UserRole;
      
      const calculator = getPerformanceCalculator(userRole);
      if (!calculator) return null;

      return calculator(
        user.id,
        user.name || user.email,
        user.email,
        patients,
        dateRange
      );
    }).filter((p): p is UserPerformance => p !== null);
  }, [filteredUsers, patients, dateRange]);

  // Prepare export data
  const prepareExportData = (): ExportData => {
    const periodLabels: Record<ReportPeriod, string> = {
      today: 'Today',
      week: 'Last 7 Days',
      month: 'This Month',
      year: 'This Year',
      custom: 'Custom Period',
    };

    const summaryRows = userPerformances.map(perf => {
      const roleLabel = perf.role.replace('_', ' ');
      return [
        perf.userName,
        perf.userEmail,
        roleLabel,
        ...Object.values(perf.metrics).map(v => String(v || 0)),
      ];
    });

    const headers = ['User Name', 'Email', 'Role', ...Object.keys(userPerformances[0]?.metrics || {})];

    return {
      title: 'User Performance Reports',
      period: periodLabels[selectedPeriod],
      dateRange: {
        start: formatDate(dateRange.startDate.toISOString()),
        end: formatDate(dateRange.endDate.toISOString()),
      },
      summary: [
        { label: 'Total Users', value: userPerformances.length },
        { label: 'Role Filter', value: selectedRole === 'all' ? 'All Roles' : selectedRole },
        { label: 'Period', value: periodLabels[selectedPeriod] },
      ],
      tables: [
        {
          title: 'User Performance Summary',
          headers,
          rows: summaryRows,
        },
      ],
    };
  };

  const handleExportPDF = async () => {
    if (userPerformances.length === 0) {
      showError('No performance data to export');
      return;
    }
    const data = prepareExportData();
    await exportToPDF(data);
    setExportMenuOpen(false);
    showSuccess('Performance report exported as PDF');
  };

  const handleExportExcel = () => {
    if (userPerformances.length === 0) {
      showError('No performance data to export');
      return;
    }
    const data = prepareExportData();
    exportToExcel(data);
    setExportMenuOpen(false);
    showSuccess('Performance report exported as Excel');
  };

  const handleExportCSV = () => {
    if (userPerformances.length === 0) {
      showError('No performance data to export');
      return;
    }
    const data = prepareExportData();
    exportToCSV(data);
    setExportMenuOpen(false);
    showSuccess('Performance report exported as CSV');
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

  const getRoleMetrics = (role: UserRole) => {
    switch (role) {
      case UserRole.RECEPTIONIST:
        return ['Patients Registered', 'Appointments Scheduled'];
      case UserRole.OPTOMETRIST:
        return ['Patients Seen', 'Prescriptions Created', 'Avg Consultation Time'];
      case UserRole.PHARMACIST:
        return ['Medications Dispensed', 'Prescriptions Filled', 'Pharmacy Revenue'];
      case UserRole.OPTICAL_DISPENSER:
        return ['Frames Dispensed', 'Lenses Dispensed', 'Optical Revenue'];
      case UserRole.BILLING_OFFICER:
        return ['Payments Processed', 'Revenue Collected', 'Avg Transaction', 'Insurance Claims'];
      case UserRole.MANAGER:
        return ['Patients Oversaw', 'Departments Monitored', 'Reports Generated'];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">User Performance Reports</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Role-specific job performance analytics</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as ReportPeriod)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setSelectedUserId('all');
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
            >
              <option value="all">All Roles</option>
              <option value={UserRole.RECEPTIONIST}>Receptionist</option>
              <option value={UserRole.OPTOMETRIST}>Optometrist</option>
              <option value={UserRole.PHARMACIST}>Pharmacist</option>
              <option value={UserRole.OPTICAL_DISPENSER}>Optical Dispenser</option>
              <option value={UserRole.BILLING_OFFICER}>Billing Officer</option>
              <option value={UserRole.MANAGER}>Manager</option>
            </select>
            {selectedRole !== 'all' && (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
              >
                <option value="all">All Users</option>
                {filteredUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            )}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={userPerformances.length === 0}
                className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-semibold text-sm hover:bg-brand-primary-dark transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-download"></i>
                Export Report
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
        </div>
      </div>

      {/* Performance Cards */}
      {userPerformances.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {userPerformances.map((performance) => {
            const metrics = Object.entries(performance.metrics).filter(([_, value]) => value !== undefined);
            const roleMetrics = getRoleMetrics(performance.role);

            return (
              <div key={performance.userId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 mb-1">{performance.userName}</h2>
                    <p className="text-sm text-slate-500 font-semibold">{performance.userEmail}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-brand-primary-50 text-brand-primary-dark rounded-lg text-xs font-bold uppercase">
                      {performance.role.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Period</p>
                    <p className="text-sm font-bold text-slate-700">
                      {formatDate(performance.dateRange.start)} - {formatDate(performance.dateRange.end)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metrics.map(([key, value], index) => {
                    const label = roleMetrics[index] || key.replace(/([A-Z])/g, ' $1').trim();
                    const isRevenue = key.toLowerCase().includes('revenue') || key.toLowerCase().includes('collected');
                    const displayValue = isRevenue && typeof value === 'number' 
                      ? formatCurrency(value) 
                      : String(value || 0);

                    return (
                      <div key={key} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-semibold text-slate-600 mb-2">{label}</p>
                        <p className="text-xl font-black text-slate-900">{displayValue}</p>
                      </div>
                    );
                  })}
                </div>

                {performance.details?.patients && performance.details.patients.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-4">Related Patients ({performance.details.patients.length})</h3>
                    <div className="max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {performance.details.patients.slice(0, 10).map(patient => (
                          <div key={patient.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-sm font-semibold text-slate-700">{patient.name}</span>
                            <span className="text-xs text-slate-500">{patient.id}</span>
                          </div>
                        ))}
                        {performance.details.patients.length > 10 && (
                          <p className="text-xs text-slate-500 text-center">
                            +{performance.details.patients.length - 10} more patients
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <i className="fas fa-user-chart text-4xl text-slate-300 mb-4"></i>
          <p className="text-sm font-semibold text-slate-600 mb-1">No performance data available</p>
          <p className="text-xs text-slate-500">Select a role and period to view performance reports</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceReports;
