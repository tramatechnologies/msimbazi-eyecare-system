/**
 * System Settings View
 * Admin-only view for system configuration
 */

import React, { useState } from 'react';

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    clinicName: 'Msimbazi Eye Care',
    clinicAddress: '',
    clinicPhone: '',
    clinicEmail: '',
    workingHours: '08:00 - 17:00',
    enableNotifications: true,
    enableAuditLogging: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-slate-900">System Settings</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Configure system-wide settings</p>
      </div>

      {/* Clinic Information */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Clinic Information</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Clinic Name</label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => setSettings({...settings, clinicName: e.target.value})}
              placeholder="Enter Clinic Name"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Phone Number</label>
              <input
                type="tel"
                value={settings.clinicPhone}
                onChange={(e) => setSettings({...settings, clinicPhone: e.target.value})}
                placeholder="Enter Phone Number"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Email Address</label>
              <input
                type="email"
                value={settings.clinicEmail}
                onChange={(e) => setSettings({...settings, clinicEmail: e.target.value})}
                placeholder="Enter Email Address"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Address</label>
            <textarea
              value={settings.clinicAddress}
              onChange={(e) => setSettings({...settings, clinicAddress: e.target.value})}
              placeholder="Enter Clinic Address"
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none"
            />
          </div>
        </div>
      </div>

      {/* System Preferences */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">System Preferences</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Enable Notifications</p>
              <p className="text-xs text-slate-500 mt-1">Send system notifications to users</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={(e) => setSettings({...settings, enableNotifications: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Audit Logging</p>
              <p className="text-xs text-slate-500 mt-1">Track all system activities</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableAuditLogging}
                onChange={(e) => setSettings({...settings, enableAuditLogging: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-all">
          Cancel
        </button>
        <button 
          className="px-6 py-3 text-white rounded-xl font-semibold text-sm transition-all"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;
