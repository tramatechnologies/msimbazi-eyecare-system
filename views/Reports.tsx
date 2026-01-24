/**
 * Reports & Analytics View
 * Admin and Manager view for comprehensive system reports and analytics
 */

import React, { useState, useMemo, useRef } from 'react';
import { usePatients } from '../contexts/PatientContext';
import { PatientStatus, InsuranceType } from '../types';
import { calculateBillTotal, calculateInsuranceCoverage } from '../utils/patientUtils';
import { formatDate, getCurrentDate } from '../utils/dateTimeUtils';
import { exportToPDF, exportToExcel, exportToCSV, ExportData, formatCurrency, formatPercentage } from '../utils/exportUtils';

type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

const Reports: React.FC = () => {
  const { patients } = usePatients();
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('today');
  const [selectedReport, setSelectedReport] = useState<string>('overview');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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

  // Filter patients by date range
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const checkInDate = new Date(p.checkedInAt);
      return checkInDate >= dateRange.startDate && checkInDate <= dateRange.endDate;
    });
  }, [patients, dateRange]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalRevenue = filteredPatients.reduce((sum, p) => {
      return sum + calculateBillTotal(p.billItems);
    }, 0);

    const insuranceCoverage = filteredPatients.reduce((sum, p) => {
      return sum + calculateInsuranceCoverage(p);
    }, 0);

    const netRevenue = totalRevenue - insuranceCoverage;

    const completedPatients = filteredPatients.filter(p => p.status === PatientStatus.COMPLETED).length;
    const nhifPatients = filteredPatients.filter(p => p.insuranceType === InsuranceType.NHIF).length;
    const privatePatients = filteredPatients.filter(p => p.insuranceType === InsuranceType.PRIVATE).length;
    const cashPatients = filteredPatients.filter(p => p.insuranceType === InsuranceType.CASH).length;

    // Department statistics
    const clinicalCount = filteredPatients.filter(p => 
      p.status === PatientStatus.IN_CLINICAL || 
      p.status === PatientStatus.PENDING_TREATMENT
    ).length;
    const pharmacyCount = filteredPatients.filter(p => p.status === PatientStatus.IN_PHARMACY).length;
    const opticalCount = filteredPatients.filter(p => p.status === PatientStatus.IN_OPTICAL).length;
    const billingCount = filteredPatients.filter(p => p.status === PatientStatus.PENDING_BILLING).length;

    // Revenue by category
    const clinicalRevenue = filteredPatients.reduce((sum, p) => {
      return sum + p.billItems
        .filter(item => item.category === 'CLINICAL')
        .reduce((s, item) => s + item.amount, 0);
    }, 0);

    const pharmacyRevenue = filteredPatients.reduce((sum, p) => {
      return sum + p.billItems
        .filter(item => item.category === 'PHARMACY')
        .reduce((s, item) => s + item.amount, 0);
    }, 0);

    const opticalRevenue = filteredPatients.reduce((sum, p) => {
      return sum + p.billItems
        .filter(item => item.category === 'OPTICAL')
        .reduce((s, item) => s + item.amount, 0);
    }, 0);

    return {
      totalRevenue,
      insuranceCoverage,
      netRevenue,
      totalPatients: filteredPatients.length,
      completedPatients,
      nhifPatients,
      privatePatients,
      cashPatients,
      clinicalCount,
      pharmacyCount,
      opticalCount,
      billingCount,
      clinicalRevenue,
      pharmacyRevenue,
      opticalRevenue,
      averageBillAmount: filteredPatients.length > 0 ? totalRevenue / filteredPatients.length : 0,
    };
  }, [filteredPatients]);

  // Prepare export data
  const prepareExportData = (): ExportData => {
    const periodLabels: Record<ReportPeriod, string> = {
      today: 'Today',
      week: 'Last 7 Days',
      month: 'This Month',
      year: 'This Year',
      custom: 'Custom Period',
    };

    // Patient details table
    const patientTableRows = filteredPatients.map(p => [
      p.id,
      p.name,
      p.gender,
      formatDate(p.checkedInAt),
      p.insuranceType,
      p.status,
      formatCurrency(calculateBillTotal(p.billItems)),
    ]);

    // Department activity table
    const departmentRows = [
      ['Clinical', statistics.clinicalCount.toString(), formatCurrency(statistics.clinicalRevenue)],
      ['Pharmacy', statistics.pharmacyCount.toString(), formatCurrency(statistics.pharmacyRevenue)],
      ['Optical', statistics.opticalCount.toString(), formatCurrency(statistics.opticalRevenue)],
      ['Billing Queue', statistics.billingCount.toString(), '-'],
    ];

    // Insurance breakdown table
    const insuranceRows = [
      ['NHIF', statistics.nhifPatients.toString(), formatCurrency(
        filteredPatients
          .filter(p => p.insuranceType === InsuranceType.NHIF)
          .reduce((sum, p) => sum + calculateInsuranceCoverage(p), 0)
      )],
      ['Private Insurance', statistics.privatePatients.toString(), formatCurrency(
        filteredPatients
          .filter(p => p.insuranceType === InsuranceType.PRIVATE)
          .reduce((sum, p) => sum + calculateInsuranceCoverage(p), 0)
      )],
      ['Cash', statistics.cashPatients.toString(), formatCurrency(
        filteredPatients
          .filter(p => p.insuranceType === InsuranceType.CASH)
          .reduce((sum, p) => sum + calculateBillTotal(p.billItems), 0)
      )],
    ];

    return {
      title: 'Reports & Analytics',
      period: periodLabels[selectedPeriod],
      dateRange: {
        start: formatDate(dateRange.startDate.toISOString()),
        end: formatDate(dateRange.endDate.toISOString()),
      },
      summary: [
        { label: 'Total Patients', value: statistics.totalPatients },
        { label: 'Completed Patients', value: statistics.completedPatients },
        { label: 'Total Revenue', value: formatCurrency(statistics.totalRevenue) },
        { label: 'Insurance Coverage', value: formatCurrency(statistics.insuranceCoverage) },
        { label: 'Net Revenue', value: formatCurrency(statistics.netRevenue) },
        { label: 'Average Bill Amount', value: formatCurrency(statistics.averageBillAmount) },
        { label: 'NHIF Patients', value: statistics.nhifPatients },
        { label: 'Private Insurance Patients', value: statistics.privatePatients },
        { label: 'Cash Patients', value: statistics.cashPatients },
      ],
      tables: [
        {
          title: 'Department Activity',
          headers: ['Department', 'Patient Count', 'Revenue'],
          rows: departmentRows,
        },
        {
          title: 'Insurance Breakdown',
          headers: ['Insurance Type', 'Patient Count', 'Coverage Amount'],
          rows: insuranceRows,
        },
        {
          title: 'Revenue by Category',
          headers: ['Category', 'Revenue', 'Percentage'],
          rows: [
            ['Clinical Services', formatCurrency(statistics.clinicalRevenue), formatPercentage(statistics.clinicalRevenue, statistics.totalRevenue)],
            ['Pharmacy', formatCurrency(statistics.pharmacyRevenue), formatPercentage(statistics.pharmacyRevenue, statistics.totalRevenue)],
            ['Optical Services', formatCurrency(statistics.opticalRevenue), formatPercentage(statistics.opticalRevenue, statistics.totalRevenue)],
          ],
        },
        ...(patientTableRows.length > 0 ? [{
          title: 'Patient Details',
          headers: ['Patient ID', 'Name', 'Gender', 'Check-in Date', 'Insurance', 'Status', 'Total Bill'],
          rows: patientTableRows,
        }] : []),
      ],
    };
  };

  const handleExportPDF = async () => {
    const data = prepareExportData();
    await exportToPDF(data);
    setExportMenuOpen(false);
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToExcel(data);
    setExportMenuOpen(false);
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-base font-normal text-slate-900 tracking-tight">Reports & Analytics</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Comprehensive system performance and analytics</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as ReportPeriod)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="px-6 py-2.5 text-white rounded-xl font-normal text-sm transition-all flex items-center gap-2 whitespace-nowrap"
                style={{ backgroundColor: 'var(--brand-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                }}
              >
                <i className="fas fa-download"></i>
                Export Report
                <i className={`fas fa-chevron-${exportMenuOpen ? 'up' : 'down'} text-xs`}></i>
              </button>
              
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-4 py-3 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3 border-b border-slate-100"
                  >
                    <i className="fas fa-file-pdf text-red-600"></i>
                    Export as PDF
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full px-4 py-3 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3 border-b border-slate-100"
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

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Revenue', 
            value: `TZS ${statistics.totalRevenue.toLocaleString()}`, 
            icon: 'fa-money-bill-wave', 
            color: 'bg-emerald-500',
            bgColor: 'bg-emerald-50',
            change: '+12%'
          },
          { 
            label: 'Patients Served', 
            value: statistics.totalPatients.toString(), 
            icon: 'fa-users', 
            color: 'bg-brand-primary',
            bgColor: 'bg-brand-primary-50',
            change: `+${statistics.completedPatients} completed`
          },
          { 
            label: 'Net Revenue', 
            value: `TZS ${statistics.netRevenue.toLocaleString()}`, 
            icon: 'fa-calculator', 
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50',
            change: `After ${statistics.insuranceCoverage.toLocaleString()} coverage`
          },
          { 
            label: 'Avg. Bill Amount', 
            value: `TZS ${Math.round(statistics.averageBillAmount).toLocaleString()}`, 
            icon: 'fa-chart-line', 
            color: 'bg-purple-500',
            bgColor: 'bg-purple-50',
            change: 'Per patient'
          },
        ].map((stat, i) => {
          // Get background color for icon container
          const getIconBgColor = (colorClass: string) => {
            const colorMap: Record<string, string> = {
              'bg-brand-primary': 'var(--brand-primary)',
              'bg-emerald-500': '#10b981',
              'bg-blue-500': '#3b82f6',
              'bg-purple-500': '#a855f7',
            };
            return colorMap[colorClass] || 'var(--brand-primary)';
          };

          return (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="p-3 rounded-xl text-white shadow-md"
                  style={{ backgroundColor: getIconBgColor(stat.color) }}
                >
                  <i className={`fas ${stat.icon} text-lg text-white`} style={{ color: '#ffffff' }}></i>
                </div>
                <span className="text-xs font-normal text-slate-500">{stat.change}</span>
              </div>
              <h3 className="text-xl font-normal text-slate-900 mb-1">{stat.value}</h3>
              <p className="text-sm font-normal text-slate-600">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Detailed Statistics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Statistics */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-normal text-slate-900 mb-6 flex items-center gap-2">
            <i className="fas fa-users text-brand-primary"></i>
            Patient Statistics
          </h2>
          <div className="space-y-4">
            {[
              { label: 'Total Patients', value: statistics.totalPatients, color: 'text-brand-primary' },
              { label: 'Completed Visits', value: statistics.completedPatients, color: 'text-emerald-600' },
              { label: 'NHIF Patients', value: statistics.nhifPatients, color: 'text-blue-600' },
              { label: 'Private Insurance', value: statistics.privatePatients, color: 'text-purple-600' },
              { label: 'Cash Patients', value: statistics.cashPatients, color: 'text-slate-600' },
            ].map((stat, i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                <span className="text-sm font-normal text-slate-700">{stat.label}</span>
                <span className={`text-base font-normal ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-normal text-slate-900 mb-6 flex items-center gap-2">
            <i className="fas fa-building text-brand-primary"></i>
            Department Activity
          </h2>
          <div className="space-y-4">
            {[
              { label: 'Clinical', value: statistics.clinicalCount, revenue: statistics.clinicalRevenue, color: 'bg-green-500' },
              { label: 'Pharmacy', value: statistics.pharmacyCount, revenue: statistics.pharmacyRevenue, color: 'bg-cyan-500' },
              { label: 'Optical', value: statistics.opticalCount, revenue: statistics.opticalRevenue, color: 'bg-blue-500' },
              { label: 'Billing Queue', value: statistics.billingCount, revenue: 0, color: 'bg-purple-500' },
            ].map((dept, i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`${dept.color} w-3 h-3 rounded-full`}></div>
                  <span className="text-sm font-normal text-slate-700">{dept.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-base font-normal text-slate-900">{dept.value} patients</div>
                  {dept.revenue > 0 && (
                    <div className="text-xs font-normal text-slate-500">TZS {dept.revenue.toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-normal text-slate-900 mb-6 flex items-center gap-2">
          <i className="fas fa-chart-pie text-brand-primary"></i>
          Revenue Breakdown by Category
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { 
              label: 'Clinical Services', 
              amount: statistics.clinicalRevenue, 
              percentage: statistics.totalRevenue > 0 ? (statistics.clinicalRevenue / statistics.totalRevenue * 100).toFixed(1) : '0',
              color: 'bg-green-500',
              icon: 'fa-stethoscope'
            },
            { 
              label: 'Pharmacy', 
              amount: statistics.pharmacyRevenue, 
              percentage: statistics.totalRevenue > 0 ? (statistics.pharmacyRevenue / statistics.totalRevenue * 100).toFixed(1) : '0',
              color: 'bg-cyan-500',
              icon: 'fa-pills'
            },
            { 
              label: 'Optical Services', 
              amount: statistics.opticalRevenue, 
              percentage: statistics.totalRevenue > 0 ? (statistics.opticalRevenue / statistics.totalRevenue * 100).toFixed(1) : '0',
              color: 'bg-blue-500',
              icon: 'fa-glasses'
            },
          ].map((category, i) => (
            <div key={i} className="p-6 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`${category.color} p-3 rounded-xl text-white`}>
                  <i className={`fas ${category.icon} text-lg`}></i>
                </div>
                <span className="text-xs font-normal text-slate-500">{category.percentage}%</span>
              </div>
              <h3 className="text-lg font-normal text-slate-900 mb-1">TZS {category.amount.toLocaleString()}</h3>
              <p className="text-sm font-normal text-slate-600">{category.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Insurance Coverage Analysis */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-normal text-slate-900 mb-6 flex items-center gap-2">
          <i className="fas fa-shield-alt text-brand-primary"></i>
          Insurance Coverage Analysis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-brand-primary-50 rounded-xl border border-brand-primary-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-normal text-brand-primary-dark">NHIF Coverage</span>
              <i className="fas fa-shield-check text-brand-primary text-lg"></i>
            </div>
            <div className="text-lg font-bold text-brand-primary-dark mb-1">
              TZS {filteredPatients
                .filter(p => p.insuranceType === InsuranceType.NHIF)
                .reduce((sum, p) => sum + calculateInsuranceCoverage(p), 0)
                .toLocaleString()}
            </div>
            <p className="text-xs font-normal text-slate-600">{statistics.nhifPatients} patients</p>
          </div>
          <div className="p-6 bg-purple-50 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-normal text-purple-700">Private Insurance</span>
              <i className="fas fa-building text-purple-600 text-lg"></i>
            </div>
            <div className="text-lg font-bold text-purple-700 mb-1">
              TZS {filteredPatients
                .filter(p => p.insuranceType === InsuranceType.PRIVATE)
                .reduce((sum, p) => sum + calculateInsuranceCoverage(p), 0)
                .toLocaleString()}
            </div>
            <p className="text-xs font-normal text-slate-600">{statistics.privatePatients} patients</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-normal text-slate-700">Out of Pocket</span>
              <i className="fas fa-money-bill text-slate-600 text-lg"></i>
            </div>
            <div className="text-lg font-bold text-slate-900 mb-1">
              TZS {filteredPatients
                .filter(p => p.insuranceType === InsuranceType.CASH)
                .reduce((sum, p) => sum + calculateBillTotal(p.billItems), 0)
                .toLocaleString()}
            </div>
            <p className="text-xs font-normal text-slate-600">{statistics.cashPatients} patients</p>
          </div>
        </div>
      </div>

      {/* Period Summary */}
      <div className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-normal text-white/80 uppercase tracking-widest mb-2">Report Period</h3>
            <p className="text-lg font-normal">
              {formatDate(dateRange.startDate.toISOString())} - {formatDate(dateRange.endDate.toISOString())}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-normal text-white/80 uppercase tracking-widest mb-2">Total Patients</p>
            <p className="text-3xl font-normal">{statistics.totalPatients}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
