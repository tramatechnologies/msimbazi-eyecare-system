
import React, { useState, useMemo, useEffect } from 'react';
import { PatientStatus, PrescriptionHistoryEvent, InsuranceType } from '../types';
import { usePatients } from '../contexts/PatientContext';
import { useToast } from '../components/Toast';
import { generateBillItemId } from '../utils/idGenerator';
import { createBillItem, createPrescription } from '../services/patientService';
import NHIFVerificationBadge from '../components/NHIFVerificationBadge';
import { getPatientVisit } from '../services/nhifService';
import { canDispenseOptical } from '../utils/nhifGating';
import { logCriticalOperation } from '../services/auditLogService';

const LENS_TYPES = [
  { name: 'Single Vision - Distance', basePrice: 20000, nhifEligible: true, nhifCap: 20000 },
  { name: 'Single Vision - Reading', basePrice: 20000, nhifEligible: true, nhifCap: 20000 },
  { name: 'Bifocal - Flat Top', basePrice: 45000, nhifEligible: true, nhifCap: 40000 },
  { name: 'Bifocal - Round Top', basePrice: 45000, nhifEligible: true, nhifCap: 40000 },
  { name: 'Progressive - Standard', basePrice: 85000, nhifEligible: false, nhifCap: 0 },
];

const LENS_INDICES = [
  { index: '1.50 (Standard)', premium: 0, nhifEligible: true },
  { index: '1.56 (Mid-Index)', premium: 15000, nhifEligible: true },
  { index: '1.61 (High-Index)', premium: 35000, nhifEligible: false },
];

const LENS_EDGE_COLORS = [
  { name: 'Clear', price: 0 }, { name: 'Sky Blue', price: 5000 }, { name: 'Forest Green', price: 5000 },
];

const COATINGS = [
  { name: 'Hard Coat', price: 10000, nhifEligible: true, nhifCap: 10000 },
  { name: 'Anti-Reflective', price: 25000, nhifEligible: false, nhifCap: 0 },
  { name: 'Blue Cut', price: 40000, nhifEligible: false, nhifCap: 0 },
];

const NHIF_REGS = {
  FRAME_CAP: 30000,
  MAX_TOTAL_REIMBURSEMENT: 80000,
};

const OpticalDispensing: React.FC = () => {
  const { patients, updatePatient, refreshPatient, useApi } = usePatients();
  const { success: showSuccess, error: showError } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lensType, setLensType] = useState(LENS_TYPES[0].name);
  const [lensIndex, setLensIndex] = useState(LENS_INDICES[0].index);
  const [edgeColor, setEdgeColor] = useState(LENS_EDGE_COLORS[0].name);
  const [selectedCoatings, setSelectedCoatings] = useState<string[]>([]);
  const [frameDetails, setFrameDetails] = useState('');
  const [framePrice, setFramePrice] = useState(0);
  const [od, setOd] = useState('');
  const [os, setOs] = useState('');
  const [addOd, setAddOd] = useState('');
  const [addOs, setAddOs] = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [useCase, setUseCase] = useState('Daily Use');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [detailViewEvent, setDetailViewEvent] = useState<PrescriptionHistoryEvent | null>(null);

  const [claimFrameNHIF, setClaimFrameNHIF] = useState(false);
  const [claimLensNHIF, setClaimLensNHIF] = useState(false);

  const activePatient = patients.find(p => p.id === selectedId);
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [nhifGateResult, setNhifGateResult] = useState<{ allowed: boolean; reason?: string } | null>(null);
  
  const opticalQueue = patients.filter(p => p.status === PatientStatus.PENDING_BILLING || p.status === PatientStatus.IN_OPTICAL || (p.prescription && p.status !== PatientStatus.COMPLETED));

  // Refresh patient data when selected
  useEffect(() => {
    if (selectedId) {
      refreshPatient(selectedId).catch(err => {
        console.error('Failed to refresh patient:', err);
      });
    }
  }, [selectedId, refreshPatient]);

  // Fetch visit ID for NHIF patients
  useEffect(() => {
    if (activePatient && activePatient.insuranceType === InsuranceType.NHIF) {
      getPatientVisit(activePatient.id)
        .then((result) => {
          if (result.success && result.visit) {
            setCurrentVisitId(result.visit.id);
            canDispenseOptical(result.visit.id).then((gateResult) => {
              setNhifGateResult(gateResult);
            });
          }
        })
        .catch(() => {});
    } else {
      setCurrentVisitId(null);
      setNhifGateResult(null);
    }
  }, [activePatient]);

  useEffect(() => {
    if (activePatient) {
      setOd(activePatient.prescription?.od || ''); 
      setOs(activePatient.prescription?.os || ''); 
      setAddOd(activePatient.prescription?.addOd || activePatient.prescription?.add || ''); 
      setAddOs(activePatient.prescription?.addOs || activePatient.prescription?.add || ''); 
      setEdgeColor(activePatient.prescription?.edgeColor || LENS_EDGE_COLORS[0].name);
    }
  }, [activePatient]);

  const pricingSummary = useMemo(() => {
    const selectedLens = LENS_TYPES.find(t => t.name === lensType)!;
    const selectedIdx = LENS_INDICES.find(i => i.index === lensIndex)!;
    const selectedEdge = LENS_EDGE_COLORS.find(e => e.name === edgeColor)!;
    const coatingTotal = selectedCoatings.reduce((acc, cName) => acc + (COATINGS.find(coating => coating.name === cName)?.price || 0), 0);
    const subtotalLens = selectedLens.basePrice + selectedIdx.premium + coatingTotal + selectedEdge.price;
    const total = subtotalLens + framePrice;
    let nhifDeduction = 0;
    if (activePatient?.insuranceType === InsuranceType.NHIF) {
      if (claimFrameNHIF) nhifDeduction += Math.min(framePrice, NHIF_REGS.FRAME_CAP);
      if (claimLensNHIF) {
        if (selectedLens.nhifEligible) nhifDeduction += Math.min(selectedLens.basePrice, selectedLens.nhifCap);
        if (selectedIdx.nhifEligible) nhifDeduction += selectedIdx.premium;
        selectedCoatings.forEach(cName => { const c = COATINGS.find(coat => coat.name === cName); if (c?.nhifEligible) nhifDeduction += c.nhifCap; });
      }
      nhifDeduction = Math.min(nhifDeduction, NHIF_REGS.MAX_TOTAL_REIMBURSEMENT);
    }
    return { subtotalLens, total, nhifDeduction, netPayable: total - nhifDeduction };
  }, [lensType, lensIndex, edgeColor, selectedCoatings, framePrice, activePatient, claimFrameNHIF, claimLensNHIF]);

  const handleCompleteDispensing = async () => {
    if (!activePatient) {
      showError('Please select a patient');
      return;
    }

    if (!frameDetails.trim() && framePrice === 0 && pricingSummary.subtotalLens === 0) {
      showError('Please add frame details or lens configuration');
      return;
    }

    const totalAmount = pricingSummary.total;
    if (!confirm(`Are you sure you want to complete optical dispensing for ${activePatient.name}? Total amount: TZS ${totalAmount.toLocaleString()}. This will finalize the order.`)) {
      return;
    }

    // Check NHIF service gate
    if (activePatient.insuranceType === InsuranceType.NHIF && currentVisitId) {
      const gateResult = await canDispenseOptical(currentVisitId);
      if (!gateResult.allowed) {
        showError(gateResult.reason || 'NHIF verification required before dispensing optical items');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Check if patient needs medications by checking consultation notes/plan
      const consultationNotes = activePatient.consultationNotes || '';
      const clinicalNotes = activePatient.clinicalNotes || '';
      const combinedNotes = (consultationNotes + ' ' + clinicalNotes).toLowerCase();
      
      const needsMedications = combinedNotes.includes('medication') || 
                              combinedNotes.includes('drops') || 
                              combinedNotes.includes('eye drops') ||
                              combinedNotes.includes('prescribe') ||
                              combinedNotes.includes('prescription') ||
                              combinedNotes.includes('ointment') ||
                              combinedNotes.includes('tablet') ||
                              combinedNotes.includes('pharmacy');

      // Route to Pharmacy if medications needed, otherwise to Billing
      const nextStatus = needsMedications ? PatientStatus.IN_PHARMACY : PatientStatus.PENDING_BILLING;
      const successMessage = needsMedications 
        ? 'Optical order submitted. Patient routed to Pharmacy for medications.'
        : 'Optical order submitted for billing';

      // Prepare prescription update
      const prescriptionUpdate = {
        ...activePatient.prescription,
        od,
        os,
        addOd,
        addOs,
        edgeColor
      };

      // Prepare bill items
      const newBillItems = [];
      if (frameDetails.trim() || framePrice > 0) {
        newBillItems.push({
          id: generateBillItemId(),
          description: frameDetails.trim() ? `Frame: ${frameDetails}` : 'Frame',
          amount: framePrice,
          category: 'OPTICAL' as const,
          isCoveredByNHIF: claimFrameNHIF,
          isCoveredByPrivate: true
        });
      }
      if (pricingSummary.subtotalLens > 0) {
        newBillItems.push({
          id: generateBillItemId(),
          description: `Lens Engineering: ${lensType} (${lensIndex})`,
          amount: pricingSummary.subtotalLens,
          category: 'OPTICAL' as const,
          isCoveredByNHIF: claimLensNHIF,
          isCoveredByPrivate: true
        });
      }

      // Create prescription via API if available
      if (useApi && (od || os || addOd || addOs)) {
        try {
          await createPrescription(activePatient.id, prescriptionUpdate);
        } catch (apiError) {
          console.warn('Failed to create prescription via API, will update via patient update:', apiError);
        }
      }

      // Create bill items via API if available
      if (useApi && newBillItems.length > 0) {
        try {
          for (const item of newBillItems) {
            await createBillItem(activePatient.id, item);
          }
        } catch (apiError) {
          console.warn('Failed to create bill items via API, falling back to update:', apiError);
        }
      }

      // Update patient with prescription and bill items
      const result = await updatePatient(activePatient.id, {
        status: nextStatus,
        prescription: prescriptionUpdate,
        billItems: [...(activePatient.billItems || []), ...newBillItems]
      });

      if (result.success) {
        // Log optical dispensing
        await logCriticalOperation(
          'DISPENSE_OPTICAL',
          'PATIENT',
          activePatient.id,
          {
            patientName: activePatient.name,
            totalAmount: pricingSummary.total,
            frameDetails: frameDetails,
            lensType: lensType,
            nextStatus: nextStatus,
          }
        );

        // Refresh patient data to get updated information
        await refreshPatient(activePatient.id);
        showSuccess(successMessage);
        setSelectedId(null);
        // Reset form
        setFrameDetails('');
        setFramePrice(0);
        setSelectedCoatings([]);
        setClaimFrameNHIF(false);
        setClaimLensNHIF(false);
      } else {
        showError(result.error ?? 'Failed to submit order');
      }
    } catch (error) {
      showError('An error occurred while processing the order');
      console.error('Optical dispensing error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full overflow-hidden">
      <div className="lg:col-span-1 space-y-4 overflow-hidden flex flex-col">
        <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest px-2">Order Queue</h3>
        <div className="flex-1 overflow-y-auto space-y-3 px-2 custom-scrollbar">
          {opticalQueue.map(p => (
            <button 
              key={p.id} 
              onClick={() => setSelectedId(p.id)} 
              className={`w-full p-5 rounded-[2rem] text-left border transition-all ${selectedId === p.id ? 'border-brand-primary text-white shadow-xl translate-x-1' : 'bg-white border-slate-200'}`}
              style={selectedId === p.id ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' } : {}}
            >
              <div className="flex justify-between items-start mb-2"> <span className="font-black truncate">{p.name}</span> <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${selectedId === p.id ? 'bg-brand-primary-light' : 'bg-slate-100'}`}>{p.insuranceType}</span> </div>
              <p className={`text-[10px] font-bold ${selectedId === p.id ? 'text-white/80' : 'text-slate-400'}`}>ID: {p.id}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="lg:col-span-3 flex flex-col overflow-hidden">
        {activePatient ? (
          <>
            {/* NHIF Verification Badge */}
            {activePatient.insuranceType === InsuranceType.NHIF && currentVisitId && (
              <div className="mb-4">
                <NHIFVerificationBadge visitId={currentVisitId} compact />
                {nhifGateResult && !nhifGateResult.allowed && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-700">
                      <i className="fas fa-ban mr-2"></i>
                      {nhifGateResult.reason}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
              <div> <h2 className="text-xl font-black text-slate-900 tracking-tight">{activePatient.name}</h2> <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{activePatient.insuranceType} Dispensing</span> </div>
              <button 
                onClick={handleCompleteDispensing} 
                disabled={isSubmitting}
                className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Submit for Billing'}
              </button>
            </div>
            <div className="flex-1 p-8 space-y-12 overflow-y-auto custom-scrollbar">
              <section className="space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-3"> <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">1</span> Custom Lens Config </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2"> <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Profile</label> <select value={lensType} onChange={(e) => setLensType(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none"> {LENS_TYPES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)} </select> </div>
                  <div className="space-y-2"> <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Index</label> <select value={lensIndex} onChange={(e) => setLensIndex(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none"> {LENS_INDICES.map(i => <option key={i.index} value={i.index}>{i.index}</option>)} </select> </div>
                  <div className="space-y-2"> <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Edge</label> <select value={edgeColor} onChange={(e) => setEdgeColor(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none"> {LENS_EDGE_COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)} </select> </div>
                  <div className="space-y-2"> <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lens Price</label> <div className="px-5 py-3.5 bg-slate-900 border border-slate-800 rounded-2xl font-black text-sm text-blue-400 text-center"> {pricingSummary.subtotalLens.toLocaleString()} </div> </div>
                </div>
              </section>
              <section className="space-y-6">
                <div className="flex justify-between items-center"> <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-3"> <span className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">2</span> Frame Selection </h4> {activePatient.insuranceType === InsuranceType.NHIF && <label className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 cursor-pointer"> <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Apply NHIF Frame Allowance</span> <input type="checkbox" checked={claimFrameNHIF} onChange={(e) => setClaimFrameNHIF(e.target.checked)} className="w-5 h-5 rounded-lg text-emerald-600" /> </label>} </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2"> <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Frame Serial/Description</label> <input type="text" value={frameDetails} onChange={(e) => setFrameDetails(e.target.value)} placeholder="Enter Frame Details" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500" /> </div>
                  <div className="space-y-4"> <div className="space-y-2"> <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Retail Price (TZS)</label> <input type="number" value={framePrice === 0 ? '' : framePrice} onChange={(e) => setFramePrice(parseFloat(e.target.value) || 0)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none" /> </div> </div>
                </div>
              </section>
            </div>
            <div className="p-8 bg-slate-950 border-t border-slate-800 text-white">
              <div className="flex justify-between items-end">
                <div> <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Final Balance (Unified Billing)</p> <span className="text-4xl font-black tracking-tighter">TZS {pricingSummary.netPayable.toLocaleString()}</span> </div>
                <div className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest"> {activePatient.insuranceType} Coverage Applied: TZS {pricingSummary.nhifDeduction.toLocaleString()} </div>
              </div>
            </div>
          </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-dashed border-slate-200 p-12 text-center"> <div className="w-28 h-28 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8"> <i className="fas fa-glasses text-5xl text-slate-200"></i> </div> <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Optical Fitting Workspace</h3> <p className="text-slate-400 max-w-sm font-medium uppercase text-[10px] tracking-widest">Select a patient order from the left to start fitting.</p> </div>
        )}
      </div>
    </div>
  );
};

export default OpticalDispensing;
