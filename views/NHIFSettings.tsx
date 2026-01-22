/**
 * NHIF Settings View
 * Admin-only view for configuring NHIF API credentials and settings
 */

import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';

const NHIFSettings: React.FC = () => {
  const { success: showSuccess, error: showError } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    facilityCode: '',
    facilityName: '',
    nhifApiUrl: 'https://api.nhif.go.tz',
    nhifUsername: '',
    nhifPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from secure config API
      // For now, load from environment or show placeholder
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = sessionStorage.getItem('authToken');
      
      if (token && API_BASE_URL) {
        const response = await fetch(`${API_BASE_URL}/api/nhif/config`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.config) {
            setSettings({
              facilityCode: data.config.facility_code || '',
              facilityName: data.config.facility_name || '',
              nhifApiUrl: data.config.nhif_api_url || 'https://api.nhif.go.tz',
              nhifUsername: data.config.nhif_username ? '••••••••' : '',
              nhifPassword: data.config.nhif_password ? '••••••••' : '',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading NHIF settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.facilityCode.trim()) {
      showError('Facility code is required');
      return;
    }
    if (!settings.nhifUsername.trim()) {
      showError('NHIF username is required');
      return;
    }
    if (!settings.nhifPassword.trim() || settings.nhifPassword === '••••••••') {
      showError('NHIF password is required');
      return;
    }

    setIsSaving(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = sessionStorage.getItem('authToken');

      if (!token || !API_BASE_URL) {
        showError('API not available. Please configure backend connection.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/nhif/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          facilityCode: settings.facilityCode.trim(),
          facilityName: settings.facilityName.trim(),
          nhifApiUrl: settings.nhifApiUrl.trim(),
          nhifUsername: settings.nhifUsername.trim(),
          nhifPassword: settings.nhifPassword === '••••••••' ? undefined : settings.nhifPassword.trim(),
        }),
      });

      if (response.ok) {
        showSuccess('NHIF settings saved successfully');
        // Reload to get updated config
        await loadSettings();
      } else {
        const errorData = await response.json().catch(() => ({}));
        showError(errorData.error || 'Failed to save NHIF settings');
      }
    } catch (error: any) {
      showError('An error occurred while saving settings');
      console.error('Save NHIF settings error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = sessionStorage.getItem('authToken');

      if (!token || !API_BASE_URL) {
        showError('API not available');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/nhif/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showSuccess('NHIF API connection test successful');
      } else {
        const errorData = await response.json().catch(() => ({}));
        showError(errorData.error || 'NHIF API connection test failed');
      }
    } catch (error: any) {
      showError('Failed to test NHIF connection');
      console.error('Test connection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">NHIF Configuration</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Configure NHIF API credentials and facility settings</p>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            Facility Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={settings.facilityCode}
            onChange={(e) => setSettings({ ...settings, facilityCode: e.target.value })}
            placeholder="Enter NHIF facility code"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
          />
          <p className="text-xs text-slate-500">Your NHIF-assigned facility code</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">Facility Name</label>
          <input
            type="text"
            value={settings.facilityName}
            onChange={(e) => setSettings({ ...settings, facilityName: e.target.value })}
            placeholder="Enter facility name"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            NHIF API URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={settings.nhifApiUrl}
            onChange={(e) => setSettings({ ...settings, nhifApiUrl: e.target.value })}
            placeholder="https://api.nhif.go.tz"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            NHIF Username <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={settings.nhifUsername}
            onChange={(e) => setSettings({ ...settings, nhifUsername: e.target.value })}
            placeholder="Enter NHIF API username"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
          />
          <p className="text-xs text-slate-500">Username provided by NHIF for API access</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            NHIF Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={settings.nhifPassword}
              onChange={(e) => setSettings({ ...settings, nhifPassword: e.target.value })}
              placeholder="Enter NHIF API password"
              className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          <p className="text-xs text-slate-500">Password provided by NHIF for API access. Stored securely.</p>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold text-sm hover:bg-brand-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                Save Settings
              </>
            )}
          </button>
          <button
            onClick={handleTestConnection}
            disabled={isLoading || isSaving}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Testing...
              </>
            ) : (
              <>
                <i className="fas fa-plug"></i>
                Test Connection
              </>
            )}
          </button>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <i className="fas fa-shield-alt text-yellow-600 mt-0.5"></i>
          <div>
            <p className="text-xs font-semibold text-yellow-800 mb-1">Security Notice</p>
            <p className="text-xs text-yellow-700">
              NHIF credentials are stored securely and encrypted. Never share these credentials or commit them to version control.
              In production, consider using a secure vault service for credential management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NHIFSettings;
