/**
 * Reports & Analytics View
 * Admin and Manager view for system reports
 */

import React, { useState } from 'react';

const Reports: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">View system performance and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <button className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold text-sm hover:bg-brand-primary-dark transition-all flex items-center gap-2">
            <i className="fas fa-download"></i>
            Export Report
          </button>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Revenue', value: 'TZS 0', icon: 'fa-money-bill-wave', color: 'bg-emerald-500' },
          { label: 'Patients Served', value: '0', icon: 'fa-users', color: 'bg-brand-primary' },
          { label: 'Appointments', value: '0', icon: 'fa-calendar', color: 'bg-blue-500' },
          { label: 'Prescriptions', value: '0', icon: 'fa-prescription', color: 'bg-purple-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-xl text-white`}>
                <i className={`fas ${stat.icon} text-lg`}></i>
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">{stat.value}</h3>
            <p className="text-sm text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Placeholder */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <h2 className="text-sm font-bold text-slate-900 mb-6">Analytics Overview</h2>
        <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="text-center text-slate-400">
            <i className="fas fa-chart-line text-3xl mb-3 opacity-20"></i>
            <p className="text-sm font-semibold text-slate-600">Reports and charts coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
