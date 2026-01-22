
import React, { useState } from 'react';
import { PatientStatus, InsuranceType } from '../types';
import { usePatients } from '../contexts/PatientContext';
import { useToast } from '../components/Toast';
import { calculateBillTotal, calculateInsuranceCoverage, isInsuranceEligible } from '../utils/patientUtils';
import { formatISODate, getCurrentDate } from '../utils/dateTimeUtils';

const Billing: React.FC = () => {
  const { patients, updatePatient } = usePatients();
  const { success: showSuccess, error: showError } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const billingQueue = patients.filter(p => p.status === PatientStatus.PENDING_BILLING);
  const activePatient = patients.find(p => p.id === selectedId);

  const handleProcessPayment = async () => {
    if (!selectedId || !activePatient) {
      showError('Please select a patient');
      return;
    }
    const result = await updatePatient(selectedId, { status: PatientStatus.COMPLETED });
    if (result.success) {
      showSuccess(`Payment Processed Successfully for ${activePatient.name}`);
      setSelectedId(null);
    } else {
      showError(result.error ?? 'Failed to process payment');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-w-7xl mx-auto">
      <div className="lg:col-span-1 space-y-4">
        <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide px-2">Cashier Queue</h3>
        <div className="space-y-3 px-2">
          {billingQueue.map(patient => (
            <button
              key={patient.id}
              onClick={() => setSelectedId(patient.id)}
              className={`w-full p-5 bg-white rounded-xl border transition-all text-left ${
                selectedId === patient.id ? 'border-brand-primary shadow-lg shadow-brand-primary-100 ring-2 ring-brand-primary-50' : 'border-slate-200 hover:border-brand-primary-light hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-slate-800 text-sm truncate">{patient.name}</span>
                <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${
                  patient.insuranceType === InsuranceType.NHIF ? 'bg-brand-primary-100 text-brand-primary-dark' : 
                  patient.insuranceType === InsuranceType.PRIVATE ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {patient.insuranceType === InsuranceType.PRIVATE && patient.insuranceProvider 
                    ? patient.insuranceProvider 
                    : patient.insuranceType === InsuranceType.NHIF 
                    ? 'NHIF'
                    : patient.insuranceType}
                </span>
              </div>
              <div className="flex justify-between items-baseline mt-2">
                <span className="text-xs text-slate-500 font-medium">{patient.id}</span>
                <span className="text-brand-primary font-bold text-base">TZS {calculateBillTotal(patient.billItems).toLocaleString()}</span>
              </div>
            </button>
          ))}
          {billingQueue.length === 0 && (
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                <i className="fas fa-receipt text-5xl mb-4 opacity-20"></i>
                <p className="text-sm font-semibold text-slate-600">No pending bills</p>
             </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {activePatient ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Billing Summary</p>
                <h2 className="text-base font-bold text-slate-900 tracking-tight mb-3">{activePatient.name}</h2>
                <div className="flex gap-3 flex-wrap">
                  <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                    activePatient.insuranceType === InsuranceType.NHIF ? 'text-white' : 
                    activePatient.insuranceType === InsuranceType.PRIVATE ? 'bg-purple-600 text-white' : 'bg-slate-900 text-white'
                  }`}>
                    {activePatient.insuranceType === InsuranceType.PRIVATE && activePatient.insuranceProvider 
                      ? activePatient.insuranceProvider 
                      : activePatient.insuranceType === InsuranceType.NHIF 
                      ? 'NHIF'
                      : activePatient.insuranceType}
                  </span>
                  {activePatient.insuranceNumber && <span className="text-sm text-slate-500 font-medium self-center">ID: {activePatient.insuranceNumber}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Invoice Ref</p>
                <p className="text-base font-bold text-slate-900">#INV-{activePatient.id}-{new Date().getFullYear()}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">Processed: {formatDate(getCurrentDate())}</p>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Itemized Service</th>
                    <th className="text-center pb-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Dept</th>
                    <th className="text-center pb-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Eligibility</th>
                    <th className="text-right pb-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount (TZS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activePatient.billItems.map(item => {
                    const isEligible = isInsuranceEligible(item, activePatient.insuranceType);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 text-sm font-semibold text-slate-800">{item.description}</td>
                        <td className="py-4 text-center">
                          <span className="text-xs px-3 py-1 bg-slate-100 rounded-lg font-semibold text-slate-600 uppercase tracking-wide">{item.category}</span>
                        </td>
                        <td className="py-4 text-center">
                          {isEligible ? (
                            <span className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-semibold flex items-center justify-center w-fit mx-auto gap-1.5">
                              <i className="fas fa-shield-check text-xs"></i> Covered
                            </span>
                          ) : (
                            <span className="text-xs px-3 py-1 bg-slate-100 text-slate-500 rounded-full font-semibold">Out-of-Pocket</span>
                          )}
                        </td>
                        <td className="py-4 text-right font-bold text-slate-900 text-sm">{item.amount.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-8 bg-slate-950 text-white space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-semibold text-slate-400">
                  <span>Gross Total Services</span>
                  <span>TZS {calculateBillTotal(activePatient.billItems).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-brand-primary-light">
                  <span>Insurance Contribution</span>
                  <span>- TZS {calculateInsuranceCoverage(activePatient).toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-brand-primary-light uppercase tracking-wide mb-2">Net Patient Responsibility</p>
                  <span className="text-base font-bold tracking-tight">TZS {(calculateBillTotal(activePatient.billItems) - calculateInsuranceCoverage(activePatient)).toLocaleString()}</span>
                </div>
                
                <div className="flex gap-3">
                  <button className="px-6 h-12 bg-white/5 border border-white/10 rounded-xl font-semibold text-sm hover:bg-white/10 transition-all flex items-center gap-2">
                    <i className="fas fa-print"></i> Print
                  </button>
                  <button 
                    onClick={handleProcessPayment}
                    className="px-8 h-12 text-white rounded-xl font-semibold text-sm shadow-lg active:scale-95 transition-all"
                    style={{
                      backgroundColor: 'var(--brand-primary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--brand-primary-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                    }}
                  >
                    Confirm & Complete Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center group">
             <div className="w-32 h-32 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
               <i className="fas fa-file-invoice-dollar text-5xl text-slate-200"></i>
             </div>
             <h3 className="text-base font-bold text-slate-900 mb-3 tracking-tight">Billing Terminal</h3>
             <p className="text-slate-500 max-w-sm font-medium text-sm">Select an active invoice to process professional fees and claims.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Billing;
