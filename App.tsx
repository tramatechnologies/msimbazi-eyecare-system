
import React, { useState, useMemo } from 'react';
import Layout from './components/Layout';
import Registration from './views/Registration';
import Clinical from './views/Clinical';
import Billing from './views/Billing';
import OpticalDispensing from './views/OpticalDispensing';
import Pharmacy from './views/Pharmacy';
import Login from './views/Login';
import Queue from './views/Queue';
import PatientsList from './views/PatientsList';
import Appointments from './views/Appointments';
import UserManagement from './views/UserManagement';
import Reports from './views/Reports';
import SystemSettings from './views/SystemSettings';
import AuditLogs from './views/AuditLogs';
import { PatientProvider, usePatients } from './contexts/PatientContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, useToast } from './components/Toast';
import { UserRole, PatientStatus } from './types';
import { MOCK_PROVIDERS } from './constants';

// Helper function to get background color from Tailwind class
const getBackgroundColor = (colorClass: string): string => {
  const colorMap: Record<string, string> = {
    'bg-brand-primary': 'var(--brand-primary)',
    'bg-orange-500': '#f97316',
    'bg-green-500': '#22c55e',
    'bg-purple-500': '#a855f7',
    'bg-emerald-500': '#10b981',
    'bg-blue-500': '#3b82f6',
    'bg-cyan-500': '#06b6d4',
    'bg-red-500': '#ef4444',
  };
  return colorMap[colorClass] || '#64748b';
};

const STATUS_CHART_CONFIG: { status: PatientStatus; label: string; barColor: string; bgColor: string; order: number }[] = [
  { status: PatientStatus.ARRIVED, label: 'Arrived', barColor: 'bg-slate-400', bgColor: 'bg-slate-100', order: 0 },
  { status: PatientStatus.WAITING, label: 'In Queue', barColor: 'bg-orange-500', bgColor: 'bg-orange-50', order: 1 },
  { status: PatientStatus.IN_CLINICAL, label: 'Clinical', barColor: 'bg-green-500', bgColor: 'bg-green-50', order: 2 },
  { status: PatientStatus.PENDING_TREATMENT, label: 'Pending Treatment', barColor: 'bg-amber-500', bgColor: 'bg-amber-50', order: 3 },
  { status: PatientStatus.IN_PHARMACY, label: 'Pharmacy', barColor: 'bg-cyan-500', bgColor: 'bg-cyan-50', order: 4 },
  { status: PatientStatus.IN_OPTICAL, label: 'Optical', barColor: 'bg-teal-500', bgColor: 'bg-teal-50', order: 5 },
  { status: PatientStatus.PENDING_BILLING, label: 'Pending Billing', barColor: 'bg-purple-500', bgColor: 'bg-purple-50', order: 6 },
  { status: PatientStatus.COMPLETED, label: 'Completed', barColor: 'bg-emerald-600', bgColor: 'bg-emerald-50', order: 7 },
  { status: PatientStatus.CANCELLED, label: 'Cancelled', barColor: 'bg-red-400', bgColor: 'bg-red-50', order: 8 },
];

const AppContent: React.FC = () => {
  const { activeRole, changeRole, user } = useAuth();
  const { patients } = usePatients();
  const { toasts, removeToast } = useToast();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  const stats = useMemo(() => ({
    total: patients.length,
    waiting: patients.filter(p => p.status === PatientStatus.WAITING).length,
    inClinical: patients.filter(p => p.status === PatientStatus.IN_CLINICAL).length,
    pendingBilling: patients.filter(p => p.status === PatientStatus.PENDING_BILLING).length,
  }), [patients]);

  const statusDistribution = useMemo(() => {
    const counts = {} as Record<PatientStatus, number>;
    (Object.values(PatientStatus) as PatientStatus[]).forEach(s => { counts[s] = 0; });
    patients.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return counts;
  }, [patients]);

  const maxStatusCount = useMemo(() => {
    const vals = Object.values(statusDistribution);
    return Math.max(1, ...vals);
  }, [statusDistribution]);

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        const isAdmin = activeRole === UserRole.ADMIN;
        const dashboardStats = isAdmin ? [
          { label: 'Total Patients', value: stats.total, icon: 'fa-users', color: 'bg-brand-primary', bgColor: 'bg-brand-primary-50' },
          { label: 'In Queue', value: stats.waiting, icon: 'fa-clock', color: 'bg-orange-500', bgColor: 'bg-orange-50' },
          { label: 'Clinical', value: stats.inClinical, icon: 'fa-stethoscope', color: 'bg-green-500', bgColor: 'bg-green-50' },
          { label: 'Pending Bill', value: stats.pendingBilling, icon: 'fa-receipt', color: 'bg-purple-500', bgColor: 'bg-purple-50' },
          { label: 'Total Revenue', value: 'TZS 0', icon: 'fa-money-bill-wave', color: 'bg-emerald-500', bgColor: 'bg-emerald-50' },
          { label: 'Active Users', value: '0', icon: 'fa-user-shield', color: 'bg-blue-500', bgColor: 'bg-blue-50' },
          { label: 'Today\'s Appointments', value: '0', icon: 'fa-calendar-check', color: 'bg-cyan-500', bgColor: 'bg-cyan-50' },
          { label: 'System Health', value: '100%', icon: 'fa-heartbeat', color: 'bg-red-500', bgColor: 'bg-red-50' },
        ] : [
          { label: 'Total Patients', value: stats.total, icon: 'fa-users', color: 'bg-brand-primary', bgColor: 'bg-brand-primary-50' },
          { label: 'In Queue', value: stats.waiting, icon: 'fa-clock', color: 'bg-orange-500', bgColor: 'bg-orange-50' },
          { label: 'Clinical', value: stats.inClinical, icon: 'fa-stethoscope', color: 'bg-green-500', bgColor: 'bg-green-50' },
          { label: 'Pending Bill', value: stats.pendingBilling, icon: 'fa-receipt', color: 'bg-purple-500', bgColor: 'bg-purple-50' },
        ];
        
        return (
          <div className="space-y-8 max-w-7xl mx-auto">
            {/* Welcome Section for Admin */}
            {isAdmin && (
              <div className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold mb-1">Welcome back, {user?.name || (user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Admin')}!</h2>
                    <p className="text-sm text-white/80">System Administrator Dashboard</p>
                  </div>
                  <div className="hidden md:flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-white/70">Quick Actions</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handlePageChange('users')}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-all"
                        >
                          <i className="fas fa-user-shield mr-2"></i>Users
                        </button>
                        <button
                          onClick={() => handlePageChange('reports')}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-all"
                        >
                          <i className="fas fa-chart-bar mr-2"></i>Reports
                        </button>
                        <button
                          onClick={() => handlePageChange('settings')}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-all"
                        >
                          <i className="fas fa-cog mr-2"></i>Settings
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Cards - Improved sizing and typography */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6`}>
              {dashboardStats.map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-5">
                    <div 
                      className="p-3.5 rounded-xl text-white shadow-md"
                      style={{
                        backgroundColor: getBackgroundColor(stat.color),
                      }}
                    >
                      <i className={`fas ${stat.icon} text-xl`}></i>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 py-1 bg-slate-50 rounded-lg">Live</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2 leading-tight">{stat.value}</h3>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">{stat.label}</p>
                </div>
              ))}
            </div>
            
            {/* Throughput Overview - Status distribution & flow */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 mb-1">Clinic Throughput Overview</h3>
                <p className="text-sm text-slate-500 font-medium">Real-time status distribution</p>
              </div>
              <div className="p-8">
                {stats.total === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <i className="fas fa-users text-3xl text-slate-300 mb-3"></i>
                    <p className="text-sm font-medium text-slate-500">No patients in system</p>
                    <p className="text-xs text-slate-400 mt-1">Register patients to see throughput data</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      {[...STATUS_CHART_CONFIG]
                        .sort((a, b) => a.order - b.order)
                        .map(({ status, label, barColor, bgColor }) => {
                          const count = statusDistribution[status] ?? 0;
                          const pct = Math.round((count / maxStatusCount) * 100);
                          return (
                            <div key={status} className="flex items-center gap-4">
                              <div className="w-32 shrink-0 flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">{label}</span>
                                <span className="text-xs font-bold text-slate-500 tabular-nums">{count}</span>
                              </div>
                              <div className={`flex-1 h-8 rounded-lg overflow-hidden ${bgColor}`}>
                                <div
                                  className={`h-full ${barColor} rounded-lg transition-all duration-500 ease-out`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Pipeline flow</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {['Queue', 'Clinical', 'Pharmacy / Optical', 'Billing', 'Done'].map((stage, i) => (
                          <React.Fragment key={stage}>
                            <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                              {stage}
                            </span>
                            {i < 4 && <i className="fas fa-chevron-right text-slate-300 text-xs" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Admin-specific sections */}
            {isAdmin && (
              <>
                {/* Quick Access Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button
                    onClick={() => handlePageChange('users')}
                    className="bg-white p-6 rounded-xl border border-slate-200 hover:border-brand-primary hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-primary-50 rounded-xl flex items-center justify-center group-hover:bg-brand-primary transition-colors">
                        <i className="fas fa-user-shield text-brand-primary group-hover:text-white text-xl"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-1">User Management</h3>
                        <p className="text-xs text-slate-500">Manage system users and roles</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handlePageChange('reports')}
                    className="bg-white p-6 rounded-xl border border-slate-200 hover:border-brand-primary hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                        <i className="fas fa-chart-bar text-emerald-500 group-hover:text-white text-xl"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Reports & Analytics</h3>
                        <p className="text-xs text-slate-500">View system performance metrics</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handlePageChange('audit')}
                    className="bg-white p-6 rounded-xl border border-slate-200 hover:border-brand-primary hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                        <i className="fas fa-history text-purple-500 group-hover:text-white text-xl"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Audit Logs</h3>
                        <p className="text-xs text-slate-500">System activity and security logs</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* System Status */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900 mb-1">System Status</h3>
                    <p className="text-sm text-slate-500 font-medium">Real-time system health monitoring</p>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: 'Database', status: 'Online', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
                        { label: 'API Server', status: 'Online', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
                        { label: 'Authentication', status: 'Online', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
                        { label: 'Backup Status', status: 'Active', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
                      ].map((item, i) => (
                        <div key={i} className={`${item.bgColor} p-4 rounded-xl`}>
                          <p className="text-xs font-semibold text-slate-600 mb-2">{item.label}</p>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span className={`text-sm font-bold ${item.color}`}>{item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 'registration':
        return <Registration />;
      case 'patients':
        return <PatientsList />;
      case 'appointments':
        return <Appointments onOpenEMR={(patientId) => {
          // Navigate to clinical EMR with patient selected
          setCurrentPage('clinical');
          // Store patient ID in sessionStorage for Clinical component to pick up
          sessionStorage.setItem('selectedPatientId', patientId);
        }} />;
      case 'queue':
        return <Queue />;
      case 'clinical':
        return <Clinical activeProvider={MOCK_PROVIDERS[0]} />;
      case 'pharmacy':
        return <Pharmacy />;
      case 'optical':
        return <OpticalDispensing />;
      case 'billing':
        return <Billing />;
      case 'users':
        return <UserManagement />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <SystemSettings />;
      case 'audit':
        return <AuditLogs />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <i className="fas fa-hammer text-base mb-4 opacity-20"></i>
            <h3 className="text-base font-bold text-slate-800">Under Construction</h3>
            <p className="text-sm">The {currentPage} module is currently being optimized.</p>
          </div>
        );
    }
  };

  if (!activeRole) {
    return <Login />;
  }

  return (
    <>
      <Layout 
        activeRole={activeRole} 
        onRoleChange={changeRole} 
        currentPage={currentPage}
        onPageChange={handlePageChange}
        patients={patients}
      >
        {renderPage()}
      </Layout>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PatientProvider>
          <AppContent />
        </PatientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
