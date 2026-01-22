/**
 * NHIF Reports View
 * Admin and Manager view for NHIF verification analytics and reporting
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePatients } from '../contexts/PatientContext';
import { AuthorizationStatus, InsuranceType } from '../types';
import { exportToPDF, exportToExcel, exportToCSV, ExportData, formatCurrency } from '../utils/exportUtils';
import { formatDate, getCurrentDate } from '../utils/dateTimeUtils';
import { useToast } from '../components/Toast';

type ReportPeriod = 'today' | 'week' | 'month' | 'year';

const NHIFReports: React.FC = () => {
  const { patients } = usePatients();
  const { success: showSuccess, error: showError } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('today');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Calculate date range
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

  // Filter NHIF patients
  const nhifPatients = useMemo(() => {
    return patients.filter(p => {
      if (p.insuranceType !== InsuranceType.NHIF) return false;
      const checkInDate = new Date(p.checkedInAt);
      return checkInDate >= dateRange.startDate && checkInDate <= dateRange.endDate;
    });
  }, [patients, dateRange]);

  // Calculate NHIF statistics
  const statistics = useMemo(() => {
    const totalNHIF = nhifPatients.length;
    const withAuth = nhifPatients.filter(p => p.nhifAuthNumber).length;
    const withoutAuth = totalNHIF - withAuth;

    return {
      totalNHIF,
      withAuth,
      withoutAuth,
      verificationRate: totalNHIF > 0 ? ((withAuth / totalNHIF) * 100).toFixed(1) : '0',
    };
  }, [nhifPatients]);

  const prepareExportData = (): ExportData => {
    const periodLabels: Record<ReportPeriod, string> = {
      today: 'Today',
      week: 'Last 7 Days',
      month: 'This Month',
      year: 'This Year',
    };

    return {
      title: 'NHIF Verification Reports',
      period: periodLabels[selectedPeriod],
      dateRange: {
        start: formatDate(dateRange.startDate.toISOString()),
        end: formatDate(dateRange.endDate.toISOString()),
      },
      summary: [
        { label: 'Total NHIF Patients', value: statistics.totalNHIF },
        { label: 'Verified', value: statistics.withAuth },
        { label: 'Not Verified', value: statistics.withoutAuth },
        { label: 'Verification Rate', value: `${statistics.verificationRate}%` },
      ],
      tables: [{
        title: 'NHIF Patient Details',
        headers: ['Patient ID', 'Name', 'Card Number', 'Auth Number', 'Status', 'Check-in Date'],
        rows: nhifPatients.map(p => [
          p.id,
          p.name,
          p.insuranceNumber || 'N/A',
          p.nhifAuthNumber || 'Not Verified',
          p.status,
          formatDate(p.checkedInAt),
        ]),
      }],
    };
  };

  const handleExportPDF = async () => {
    if (nhifPatients.length === 0) {
      showError('No NHIF data to export');
      return;
    }
    const data = prepareExportData();
    await exportToPDF(data);
    showSuccess('NHIF report exported as PDF');
    setExportMenuOpen(false);
  };

  const handleExportExcel = () => {
    if (nhifPatients.length === 0) {
      showError('No NHIF data to export');
      return;
    }
    const data = prepareExportData();
    exportToExcel(data);
    showSuccess('NHIF report exported as Excel');
    setExportMenuOpen(false);
  };

  const handleExportCSV = () => {
    if (nhifPatients.length === 0) {
      showError('No NHIF data to export');
      return;
    }
    const data = prepareExportData();
    exportToCSV(data);
    showSuccess('NHIF report exported as CSV');
    setExportMenuOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">NHIF Verification Reports</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">NHIF card verification analytics and statistics</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
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
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={nhifPatients.length === 0}
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total NHIF Patients', 
            value: statistics.totalNHIF, 
            icon: 'fa-users', 
            color: 'bg-brand-primary',
            bgColor: 'bg-brand-primary-50'
          },
          { 
            label: 'Verified', 
            value: statistics.withAuth, 
            icon: 'fa-check-circle', 
            color: 'bg-emerald-500',
            bgColor: 'bg-emerald-50'
          },
          { 
            label: 'Not Verified', 
            value: statistics.withoutAuth, 
            icon: 'fa-exclamation-circle', 
            color: 'bg-yellow-500',
            bgColor: 'bg-yellow-50'
          },
          { 
            label: 'Verification Rate', 
            value: `${statistics.verificationRate}%`, 
            icon: 'fa-chart-line', 
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50'
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-xl text-white shadow-md`}>
                <i className={`fas ${stat.icon} text-lg`}></i>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">{stat.value}</h3>
            <p className="text-sm font-semibold text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* NHIF Patients Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">NHIF Patients ({nhifPatients.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Card Number</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">Auth Number</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wide">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nhifPatients.length > 0 ? (
                nhifPatients.map(patient => (
                  <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{patient.id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">{patient.insuranceNumber || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {patient.nhifAuthNumber ? (
                        <span className="text-sm font-mono font-semibold text-emerald-600">{patient.nhifAuthNumber}</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not verified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        patient.nhifAuthNumber 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {patient.nhifAuthNumber ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">
                      {formatDate(patient.checkedInAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                    <i className="fas fa-shield-alt text-4xl mb-4 opacity-20"></i>
                    <p className="text-sm font-semibold text-slate-600">No NHIF patients found for selected period</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NHIFReports;
