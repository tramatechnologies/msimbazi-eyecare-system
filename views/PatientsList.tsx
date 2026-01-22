
import React, { useState, useMemo } from 'react';
import { Patient, InsuranceType } from '../types';
import { usePatients } from '../contexts/PatientContext';
import { useDebounce } from '../utils/debounce';
import { searchPatients } from '../utils/patientUtils';
import { UI_TIMING } from '../constants';
import { formatISODate, formatDate } from '../utils/dateTimeUtils';

const PatientsList: React.FC = () => {
  const { patients } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const debouncedSearchTerm = useDebounce(searchTerm, UI_TIMING.DEBOUNCE_DELAY);

  const filteredPatients = useMemo(() => {
    let filtered = patients;
    
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }
    
    if (debouncedSearchTerm.trim()) {
      filtered = searchPatients(filtered, debouncedSearchTerm);
    }
    
    return filtered;
  }, [patients, filterStatus, debouncedSearchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Patient Directory</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Complete patient records database</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-11 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all font-medium"
              />
            </div>
            {/* Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
            >
              <option value="ALL">All Status</option>
              <option value="WAITING">Waiting</option>
              <option value="IN_CLINICAL">In Clinical</option>
              <option value="IN_PHARMACY">In Pharmacy</option>
              <option value="IN_OPTICAL">In Optical</option>
              <option value="PENDING_BILLING">Pending Billing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Patient</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Gender</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Insurance</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length > 0 ? (
                filteredPatients.map(patient => (
                  <tr key={patient.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-brand-primary-50 text-brand-primary rounded-full flex items-center justify-center font-semibold text-sm">
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{patient.name}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            DOB: {formatDate(patient.dob)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700 font-mono">{patient.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600">{patient.phone}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600">{patient.gender}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-3 py-1 rounded-lg font-semibold ${
                        patient.insuranceType === InsuranceType.NHIF ? 'bg-brand-primary-100 text-brand-primary-dark' : 
                        patient.insuranceType === InsuranceType.PRIVATE ? 'bg-purple-100 text-purple-700' : 
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {patient.insuranceType === InsuranceType.PRIVATE && patient.insuranceProvider 
                          ? patient.insuranceProvider 
                          : patient.insuranceType === InsuranceType.NHIF 
                          ? 'NHIF'
                          : patient.insuranceType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold uppercase whitespace-nowrap ${
                        patient.status === 'WAITING' ? 'bg-orange-100 text-orange-700' :
                        patient.status === 'IN_CLINICAL' ? 'bg-brand-primary-100 text-brand-primary-dark' :
                        patient.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        patient.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {patient.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600">
                        {formatISODate(patient.checkedInAt)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-400 bg-white">
                    <i className="fas fa-user-slash text-5xl mb-4 opacity-20"></i>
                    <p className="text-sm font-semibold text-slate-600">No patients found</p>
                    {searchTerm && (
                      <p className="text-xs text-slate-500 mt-1">Try adjusting your search or filter</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Summary */}
        {filteredPatients.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-600">
              Showing <span className="font-semibold">{filteredPatients.length}</span> of <span className="font-semibold">{patients.length}</span> patients
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientsList;
