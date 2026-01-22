
import React, { useState } from 'react';
import { PatientStatus, Medication, BillItem, InsuranceType } from '../types';
import { usePatients } from '../contexts/PatientContext';
import { useToast } from '../components/Toast';
import * as patientService from '../services/patientService';
import { generateBillItemId } from '../utils/idGenerator';
import { isInsuranceEligible } from '../utils/patientUtils';

const MOCK_MEDICATIONS: Medication[] = [
  { id: 'm1', name: 'Atropine Sulfate 1%', dosage: '10ml', form: 'Drops', price: 15000, stock: 45, isCoveredByNHIF: true, isCoveredByPrivate: true },
  { id: 'm2', name: 'Timolol Maleate 0.5%', dosage: '5ml', form: 'Drops', price: 12000, stock: 30, isCoveredByNHIF: true, isCoveredByPrivate: true },
  { id: 'm3', name: 'Ofloxacin 0.3%', dosage: '5ml', form: 'Drops', price: 18000, stock: 12, isCoveredByNHIF: false, isCoveredByPrivate: true },
  { id: 'm4', name: 'Prednisolone Acetate 1%', dosage: '5ml', form: 'Drops', price: 22000, stock: 8, isCoveredByNHIF: true, isCoveredByPrivate: true },
  { id: 'm5', name: 'Ciprofloxacin', dosage: '500mg', form: 'Tablet', price: 8000, stock: 100, isCoveredByNHIF: true, isCoveredByPrivate: true },
  { id: 'm6', name: 'Eye Lubricant (Artificial Tears)', dosage: '15ml', form: 'Drops', price: 25000, stock: 50, isCoveredByNHIF: false, isCoveredByPrivate: false },
];

const Pharmacy: React.FC = () => {
  const { patients, updatePatient } = usePatients();
  const { success: showSuccess, error: showError } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dispensingItems, setDispensingItems] = useState<{ med: Medication; qty: number }[]>([]);

  const activePatient = patients.find(p => p.id === selectedId);
  const pharmacyQueue = patients.filter(p => p.status === PatientStatus.PENDING_TREATMENT || p.status === PatientStatus.IN_PHARMACY || p.prescription?.medications);

  const filteredMeds = MOCK_MEDICATIONS.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAddToDispense = (med: Medication) => {
    if (dispensingItems.find(i => i.med.id === med.id)) return;
    setDispensingItems([...dispensingItems, { med, qty: 1 }]);
  };

  const updateQty = (id: string, delta: number) => {
    setDispensingItems(prev => prev.map(item => item.med.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  };

  const handleCompleteDispensing = async () => {
    if (!activePatient || dispensingItems.length === 0) {
      showError('Please add medications to dispense');
      return;
    }

    const newBillItems: BillItem[] = dispensingItems.map(item => ({
      id: generateBillItemId(),
      description: `Med: ${item.med.name} (${item.med.dosage}) x${item.qty}`,
      amount: item.med.price * item.qty,
      category: 'PHARMACY',
      isCoveredByNHIF: item.med.isCoveredByNHIF,
      isCoveredByPrivate: item.med.isCoveredByPrivate
    }));

    try {
      await patientService.updatePatient(activePatient.id, {
        status: PatientStatus.PENDING_BILLING,
        billItems: [...activePatient.billItems, ...newBillItems]
      });
      showSuccess('Dispensing recorded for checkout');
      setSelectedId(null);
      setDispensingItems([]);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to record dispensing');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
      <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
        <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest flex items-center justify-between px-2">Pharma Board <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">{pharmacyQueue.length}</span></h3>
        <div className="flex-1 overflow-y-auto space-y-3 px-2 custom-scrollbar">
          {pharmacyQueue.map(patient => (
            <button key={patient.id} onClick={() => { setSelectedId(patient.id); setDispensingItems([]); }} className={`w-full p-5 rounded-[2rem] text-left border transition-all ${selectedId === patient.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-black truncate">{patient.name}</span>
                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${selectedId === patient.id ? 'bg-emerald-400' : 'bg-slate-100 text-slate-500'}`}>{patient.insuranceType}</span>
              </div>
              <p className={`text-[10px] font-bold ${selectedId === patient.id ? 'text-emerald-100' : 'text-slate-400'}`}>{patient.prescription?.medications?.length || 0} Rx items</p>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden">
        {activePatient ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full min-h-0">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="relative mb-6">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input type="text" placeholder="Search pharmacy stock..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {filteredMeds.map(med => {
                  const isEligible = activePatient ? isInsuranceEligible(med, activePatient.insuranceType) : false;
                  return (
                    <div key={med.id} className="p-4 bg-white border border-slate-100 rounded-3xl hover:border-emerald-200 hover:shadow-md transition-all group flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${med.stock < 10 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}> <i className={`fas ${med.form === 'Drops' ? 'fa-eye-dropper' : 'fa-capsules'}`}></i> </div>
                        <div>
                          <h5 className="text-sm font-black text-slate-800">{med.name}</h5>
                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] font-bold text-slate-400">{med.dosage}</span>
                            {isEligible && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-brand-primary-100 text-brand-primary">Contracted</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div className="mr-2"> <p className="text-sm font-black text-slate-900">TZS {med.price.toLocaleString()}</p> <p className={`text-[10px] font-bold ${med.stock < 10 ? 'text-red-500' : 'text-slate-400'}`}>Qty: {med.stock}</p> </div>
                        <button onClick={() => handleAddToDispense(med)} disabled={med.stock <= 0} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center"> <i className="fas fa-plus"></i> </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col text-white shadow-2xl">
              <div className="mb-8 flex justify-between items-center">
                <div> <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Order</p> <h4 className="text-2xl font-black">{activePatient.name}</h4> </div>
                <div className="bg-white/10 p-3 rounded-2xl"> <i className="fas fa-shopping-basket text-emerald-400"></i> </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                {dispensingItems.map(item => (
                  <div key={item.med.id} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div> <p className="text-sm font-bold text-white">{item.med.name}</p> <p className="text-[10px] text-white/40">TZS {item.med.price.toLocaleString()} x {item.qty}</p> </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQty(item.med.id, -1)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center"> <i className="fas fa-minus text-[10px]"></i> </button>
                      <span className="font-black w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.med.id, 1)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center"> <i className="fas fa-plus text-[10px]"></i> </button>
                      <button onClick={() => setDispensingItems(dispensingItems.filter(i => i.med.id !== item.med.id))} className="ml-2 text-red-400"> <i className="fas fa-trash-alt text-[10px]"></i> </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex justify-between items-center"> <span className="text-sm font-black uppercase tracking-widest text-slate-400">Net Total</span> <span className="text-2xl font-black text-emerald-400"> TZS {dispensingItems.reduce((acc, curr) => acc + (curr.med.price * curr.qty), 0).toLocaleString()} </span> </div>
                <button onClick={handleCompleteDispensing} disabled={dispensingItems.length === 0} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-emerald-400 transition-all disabled:opacity-30"> Dispatch for Billing </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-[3rem] border border-dashed border-slate-200 p-12 text-center">
             <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6"> <i className="fas fa-pills text-4xl text-emerald-400 opacity-40"></i> </div>
             <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Pharmacy Suite</h3>
             <p className="text-slate-400 font-medium">Select a patient from the queue to dispense medications.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pharmacy;
