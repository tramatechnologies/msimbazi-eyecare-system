
import React, { useState } from 'react';
import { PatientStatus, InsuranceType } from '../types';
import { usePatients } from '../contexts/PatientContext';
import { useToast } from '../components/Toast';
import { getStatusColor } from '../utils/patientUtils';
import { formatTime, formatISODate } from '../utils/dateTimeUtils';

const Queue: React.FC = () => {
  const { patients, updatePatient } = usePatients();
  const { success: showSuccess, error: showError } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredPatients = filterStatus === 'ALL' 
    ? patients 
    : patients.filter(p => p.status === filterStatus);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Active Queue Management</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Real-time Patient Flow Tracker</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['ALL', ...Object.values(PatientStatus)].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                filterStatus === status 
                  ? 'bg-brand-primary text-white shadow-md' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Patient Details</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Arrival Time</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Insurance</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Assigned Dept</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length > 0 ? (
                filteredPatients.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-brand-primary-50 text-brand-primary rounded-full flex items-center justify-center font-semibold text-sm">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            ID: {p.id} • {p.gender}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">
                      {formatTime(p.checkedInAt.split('T')[1]?.substring(0, 5) || '')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs px-3 py-1 rounded-lg font-semibold ${
                        p.insuranceType === InsuranceType.NHIF ? 'bg-brand-primary-100 text-brand-primary-dark' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.insuranceType === InsuranceType.PRIVATE && p.insuranceProvider 
                          ? p.insuranceProvider 
                          : p.insuranceType === InsuranceType.NHIF 
                          ? 'NHIF'
                          : p.insuranceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold uppercase whitespace-nowrap ${getStatusColor(p.status)}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">
                      {p.status === PatientStatus.IN_CLINICAL ? 'Consultation' : 
                       p.status === PatientStatus.IN_OPTICAL ? 'Optical Shop' :
                       p.status === PatientStatus.IN_PHARMACY ? 'Pharmacy' : 'Reception'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={async () => {
                            const result = await updatePatient(p.id, { status: PatientStatus.CANCELLED });
                            if (result.success) {
                              showSuccess(`Visit cancelled for ${p.name}`);
                            } else {
                              showError(result.error || 'Failed to cancel visit');
                            }
                          }}
                          className="w-9 h-9 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Cancel Visit"
                        >
                          <i className="fas fa-times text-sm"></i>
                        </button>
                        <button className="w-9 h-9 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-brand-primary-50 transition-all">
                          <i className="fas fa-ellipsis-v text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 bg-white">
                    <i className="fas fa-user-slash text-base mb-4 opacity-20"></i>
                    <p className="text-sm font-semibold text-slate-600">No matching patients in queue</p>
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

export default Queue;
