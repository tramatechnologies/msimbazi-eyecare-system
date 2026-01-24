
import React, { useState, useEffect, useMemo } from 'react';
import { PatientStatus, Provider, InsuranceType } from '../types';
import { usePatients } from '../contexts/PatientContext';
import { useToast } from '../components/Toast';
import * as patientService from '../services/patientService';
import NHIFVerificationBadge from '../components/NHIFVerificationBadge';
import { getPatientVisit } from '../services/nhifService';
import { canStartConsultation } from '../utils/nhifGating';
import { 
  getClinicalSupport, 
  getDiagnosisSuggestion, 
  getICD10Suggestion, 
  getTreatmentPlanSuggestion,
  getMedicationSuggestion 
} from '../services/geminiService';
import { generateBillItemId } from '../utils/idGenerator';
import { sanitizeInput, validatePrescription } from '../utils/validation';
import { CLINICAL_FEES, VALIDATION_LIMITS } from '../constants';
import { AppError } from '../utils/errorHandler';
import { formatDate, formatTime } from '../utils/dateTimeUtils';
import { logCriticalOperation } from '../services/auditLogService';
import { getICD10Codes } from '../services/icd10Service';

interface ClinicalProps {
  activeProvider?: Provider;
}

const Clinical: React.FC<ClinicalProps> = ({ activeProvider }) => {
  const { patients, updatePatient, refreshPatient, useApi } = usePatients();
  const { success: showSuccess, error: showError } = useToast();
  
  // Check if patient ID was passed from appointments page
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(() => {
    const storedId = sessionStorage.getItem('selectedPatientId');
    if (storedId) {
      sessionStorage.removeItem('selectedPatientId');
      return storedId;
    }
    return null;
  });
  
  // History Section
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyPresentIllness, setHistoryPresentIllness] = useState('');
  const [pastOcularHistory, setPastOcularHistory] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [socialHistory, setSocialHistory] = useState('');
  const [systemicHistory, setSystemicHistory] = useState('');
  
  // Examination Section
  const [visualAcuityDistanceOD, setVisualAcuityDistanceOD] = useState('');
  const [visualAcuityDistanceOS, setVisualAcuityDistanceOS] = useState('');
  const [visualAcuityNearOD, setVisualAcuityNearOD] = useState('');
  const [visualAcuityNearOS, setVisualAcuityNearOS] = useState('');
  const [visualAcuityPinholeOD, setVisualAcuityPinholeOD] = useState('');
  const [visualAcuityPinholeOS, setVisualAcuityPinholeOS] = useState('');
  const [refractionOD, setRefractionOD] = useState('');
  const [refractionOS, setRefractionOS] = useState('');
  const [addOD, setAddOD] = useState('');
  const [addOS, setAddOS] = useState('');
  const [pupils, setPupils] = useState('');
  const [pupilSizeOD, setPupilSizeOD] = useState('');
  const [pupilSizeOS, setPupilSizeOS] = useState('');
  const [pupilReactivityOD, setPupilReactivityOD] = useState('');
  const [pupilReactivityOS, setPupilReactivityOS] = useState('');
  const [extraocularMovements, setExtraocularMovements] = useState('');
  const [anteriorSegment, setAnteriorSegment] = useState('');
  const [posteriorSegment, setPosteriorSegment] = useState('');
  const [intraocularPressureOD, setIntraocularPressureOD] = useState('');
  const [intraocularPressureOS, setIntraocularPressureOS] = useState('');
  const [tonometryMethod, setTonometryMethod] = useState('');
  const [isDilated, setIsDilated] = useState(false);
  
  // Additional Examination Tests
  const [visualField, setVisualField] = useState('');
  const [colorVision, setColorVision] = useState('');
  const [coverTest, setCoverTest] = useState('');
  const [stereopsis, setStereopsis] = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [convergence, setConvergence] = useState('');
  const [slitLampFindings, setSlitLampFindings] = useState('');
  
  // Assessment & Plan
  const [diagnosis, setDiagnosis] = useState('');
  const [icd10Code, setIcd10Code] = useState('');
  const [plan, setPlan] = useState('');
  const [followUp, setFollowUp] = useState('');
  
  // Spectacle/Correction Prescription (Professional Format)
  const [prescriptionOD, setPrescriptionOD] = useState('');
  const [prescriptionOS, setPrescriptionOS] = useState('');
  const [prescriptionAddOD, setPrescriptionAddOD] = useState('');
  const [prescriptionAddOS, setPrescriptionAddOS] = useState('');
  const [sphereOD, setSphereOD] = useState('');
  const [sphereOS, setSphereOS] = useState('');
  const [cylinderOD, setCylinderOD] = useState('');
  const [cylinderOS, setCylinderOS] = useState('');
  const [axisOD, setAxisOD] = useState('');
  const [axisOS, setAxisOS] = useState('');
  const [prismOD, setPrismOD] = useState('');
  const [prismOS, setPrismOS] = useState('');
  const [baseOD, setBaseOD] = useState('');
  const [baseOS, setBaseOS] = useState('');
  const [pupillaryDistance, setPupillaryDistance] = useState('');
  const [segmentHeight, setSegmentHeight] = useState('');
  const [lensType, setLensType] = useState('');
  
  // Medication Prescription
  const [medicationPrescriptions, setMedicationPrescriptions] = useState<Array<{
    id: string;
    medication: string;
    strength: string;
    dosage: string;
    frequency: string;
    duration: string;
    route: string;
    instructions: string;
  }>>([]);
  
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDiagnosisAiLoading, setIsDiagnosisAiLoading] = useState(false);
  const [isIcd10AiLoading, setIsIcd10AiLoading] = useState(false);
  const [isTreatmentAiLoading, setIsTreatmentAiLoading] = useState(false);
  const [isMedicationAiLoading, setIsMedicationAiLoading] = useState(false);
  const [prescriptionErrors, setPrescriptionErrors] = useState<{
    od?: string;
    os?: string;
    addOd?: string;
    addOs?: string;
  }>({});
  const [icd10Codes, setIcd10Codes] = useState<Array<{ code: string; description: string }>>([]);
  const [isLoadingIcd10, setIsLoadingIcd10] = useState(false);

  // Load ICD-10 codes from API (database)
  useEffect(() => {
    const load = async () => {
      setIsLoadingIcd10(true);
      try {
        const codes = await getICD10Codes();
        setIcd10Codes(codes);
      } catch (e) {
        console.error('Failed to load ICD-10 codes:', e);
        setIcd10Codes([]);
      } finally {
        setIsLoadingIcd10(false);
      }
    };
    load();
  }, []);

  const activePatient = patients.find(p => p.id === selectedPatientId);
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [nhifGateResult, setNhifGateResult] = useState<{ allowed: boolean; reason?: string } | null>(null);

  // When using API, fetch full patient details (incl. prescription, billItems) on select
  useEffect(() => {
    if (useApi && selectedPatientId) {
      refreshPatient(selectedPatientId).catch(() => {});
    }
  }, [useApi, selectedPatientId, refreshPatient]);

  // Fetch visit ID for NHIF patients
  useEffect(() => {
    if (activePatient && activePatient.insuranceType === InsuranceType.NHIF) {
      getPatientVisit(activePatient.id)
        .then((result) => {
          if (result.success && result.visit) {
            setCurrentVisitId(result.visit.id);
            // Check service gate
            canStartConsultation(result.visit.id).then((gateResult) => {
              setNhifGateResult(gateResult);
            });
          }
        })
        .catch(() => {
          // Visit might not exist yet
        });
    } else {
      setCurrentVisitId(null);
      setNhifGateResult(null);
    }
  }, [activePatient]);

  // Load patient data when selectedPatientId changes
  useEffect(() => {
    if (selectedPatientId && activePatient) {
      setChiefComplaint(activePatient.chiefComplaint || '');
      setPastOcularHistory(activePatient.clinicalNotes || '');
      setDiagnosis(activePatient.diagnosis || '');
      
      // Load prescription data (both legacy and professional format)
      setPrescriptionOD(activePatient.prescription?.od || '');
      setPrescriptionOS(activePatient.prescription?.os || '');
      setPrescriptionAddOD(activePatient.prescription?.addOd || activePatient.prescription?.add || '');
      setPrescriptionAddOS(activePatient.prescription?.addOs || activePatient.prescription?.add || '');
      setSphereOD(activePatient.prescription?.sphereOD || '');
      setSphereOS(activePatient.prescription?.sphereOS || '');
      setCylinderOD(activePatient.prescription?.cylinderOD || '');
      setCylinderOS(activePatient.prescription?.cylinderOS || '');
      setAxisOD(activePatient.prescription?.axisOD || '');
      setAxisOS(activePatient.prescription?.axisOS || '');
      setPrismOD(activePatient.prescription?.prismOD || '');
      setPrismOS(activePatient.prescription?.prismOS || '');
      setBaseOD(activePatient.prescription?.baseOD || '');
      setBaseOS(activePatient.prescription?.baseOS || '');
      setPupillaryDistance(activePatient.prescription?.pupillaryDistance || '');
      setSegmentHeight(activePatient.prescription?.segmentHeight || '');
      setLensType(activePatient.prescription?.lensType || '');
      
      // Load medication prescriptions
      if (activePatient.prescription?.medications && Array.isArray(activePatient.prescription.medications)) {
        setMedicationPrescriptions(activePatient.prescription.medications.map((med: any, index: number) => ({
          id: `med-${Date.now()}-${index}`,
          medication: med.name || '',
          strength: med.strength || '',
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          duration: med.duration || '',
          route: med.route || 'Ophthalmic',
          instructions: med.instructions || ''
        })));
      }
      
      // Auto-update status to IN_CLINICAL if waiting
      if (activePatient.status === PatientStatus.WAITING) {
        updatePatient(activePatient.id, { status: PatientStatus.IN_CLINICAL });
      }
    }
  }, [selectedPatientId, activePatient, updatePatient]);

  // Handler for sanitized text inputs (XSS prevention; preserveSpaces for notes)
  const handleTextChange = (
    setter: (value: string) => void,
    value: string,
    maxLength?: number,
    preserveSpaces: boolean = true
  ) => {
    const sanitized = sanitizeInput(value, preserveSpaces);
    if (!maxLength || sanitized.length <= maxLength) {
      setter(sanitized);
    }
  };

  // Handler for prescription inputs with validation
  const handlePrescriptionChange = (
    field: 'od' | 'os' | 'addOd' | 'addOs',
    value: string
  ) => {
    // Allow empty values (prescription is optional)
    if (!value.trim()) {
      setPrescriptionErrors(prev => ({ ...prev, [field]: undefined }));
      if (field === 'od') setPrescriptionOD('');
      else if (field === 'os') setPrescriptionOS('');
      else if (field === 'addOd') setPrescriptionAddOD('');
      else if (field === 'addOs') setPrescriptionAddOS('');
      return;
    }

    // Validate prescription format
    if (validatePrescription(value)) {
      setPrescriptionErrors(prev => ({ ...prev, [field]: undefined }));
      if (field === 'od') setPrescriptionOD(value);
      else if (field === 'os') setPrescriptionOS(value);
      else if (field === 'addOd') setPrescriptionAddOD(value);
      else if (field === 'addOs') setPrescriptionAddOS(value);
    } else {
      setPrescriptionErrors(prev => ({
        ...prev,
        [field]: 'Invalid prescription format. Use format like: -2.00 DS or +1.50'
      }));
    }
  };

  const handleAiInsight = async () => {
    if (!activePatient) return;
    setIsAiLoading(true);
    try {
      const combinedNotes = [
        `Chief Complaint: ${chiefComplaint}`,
        `HPI: ${historyPresentIllness}`,
        `Past Ocular History: ${pastOcularHistory}`,
        `Family History: ${familyHistory}`,
        `Medications: ${medications}`,
        `Allergies: ${allergies}`,
        `Examination: VA Distance OD ${visualAcuityDistanceOD} OS ${visualAcuityDistanceOS}, VA Near OD ${visualAcuityNearOD} OS ${visualAcuityNearOS}`,
        `Refraction: OD ${refractionOD} OS ${refractionOS}, Add OD ${addOD} OS ${addOS}`,
        `Pupils: ${pupils}, EOM: ${extraocularMovements}`,
        `Anterior Segment: ${anteriorSegment}`,
        `Posterior Segment: ${posteriorSegment}`,
        `IOP: OD ${intraocularPressureOD} OS ${intraocularPressureOS}`,
        `Diagnosis: ${diagnosis}`,
        `Plan: ${plan}`
      ].filter(Boolean).join('\n');
      
      const insight = await getClinicalSupport(chiefComplaint || '', combinedNotes);
      setAiInsights(insight || 'No insights available.');
    } catch (error) {
      // Error handling - AppError provides user-friendly messages
      if (error instanceof AppError) {
        setAiInsights(`Error: ${error.userMessage}`);
        showError(error.userMessage);
      } else if (error instanceof Error) {
        setAiInsights(`Error: ${error.message}`);
        showError(error.message);
      } else {
        setAiInsights('Unable to fetch AI insights. Please try again.');
        showError('Failed to fetch AI insights');
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Suggestion Handlers
  const handleDiagnosisSuggestion = async () => {
    setIsDiagnosisAiLoading(true);
    try {
      const examinationFindings = [
        `Visual Acuity: Distance OD ${visualAcuityDistanceOD} OS ${visualAcuityDistanceOS}`,
        `Near OD ${visualAcuityNearOD} OS ${visualAcuityNearOS}`,
        `Refraction: OD ${refractionOD} OS ${refractionOS}`,
        `IOP: OD ${intraocularPressureOD} OS ${intraocularPressureOS}`,
        `Pupils: ${pupils}`,
        `Anterior Segment: ${anteriorSegment}`,
        `Posterior Segment: ${posteriorSegment}`
      ].filter(Boolean).join('\n');

      const suggestion = await getDiagnosisSuggestion(chiefComplaint, examinationFindings);
      setDiagnosis(suggestion || diagnosis);
      showSuccess('AI diagnosis suggestion applied');
    } catch (error) {
      if (error instanceof AppError) {
        showError(error.userMessage);
      } else {
        showError('Failed to get AI diagnosis suggestion');
      }
    } finally {
      setIsDiagnosisAiLoading(false);
    }
  };

  const handleICD10Suggestion = async () => {
    setIsIcd10AiLoading(true);
    try {
      const suggestion = await getICD10Suggestion(diagnosis, chiefComplaint);
      setIcd10Code(suggestion || icd10Code);
      showSuccess('AI ICD-10 code suggestion applied');
    } catch (error) {
      if (error instanceof AppError) {
        showError(error.userMessage);
      } else {
        showError('Failed to get AI ICD-10 suggestion');
      }
    } finally {
      setIsIcd10AiLoading(false);
    }
  };

  const handleTreatmentPlanSuggestion = async () => {
    setIsTreatmentAiLoading(true);
    try {
      const examinationFindings = [
        `Visual Acuity: Distance OD ${visualAcuityDistanceOD} OS ${visualAcuityDistanceOS}`,
        `Refraction: OD ${refractionOD} OS ${refractionOS}`,
        `IOP: OD ${intraocularPressureOD} OS ${intraocularPressureOS}`,
        `Anterior Segment: ${anteriorSegment}`,
        `Posterior Segment: ${posteriorSegment}`
      ].filter(Boolean).join('\n');

      const suggestion = await getTreatmentPlanSuggestion(diagnosis, examinationFindings);
      setPlan(suggestion || plan);
      showSuccess('AI treatment plan suggestion applied');
    } catch (error) {
      if (error instanceof AppError) {
        showError(error.userMessage);
      } else {
        showError('Failed to get AI treatment plan suggestion');
      }
    } finally {
      setIsTreatmentAiLoading(false);
    }
  };

  const handleMedicationSuggestion = async () => {
    setIsMedicationAiLoading(true);
    try {
      const suggestion = await getMedicationSuggestion(diagnosis, chiefComplaint, allergies);
      // Show suggestion in a modal or append to plan
      setPlan((prev) => prev ? `${prev}\n\nMedications:\n${suggestion}` : `Medications:\n${suggestion}`);
      showSuccess('AI medication suggestions added to plan');
    } catch (error) {
      if (error instanceof AppError) {
        showError(error.userMessage);
      } else {
        showError('Failed to get AI medication suggestions');
      }
    } finally {
      setIsMedicationAiLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedPatientId || !activePatient) return;
    
    if (!confirm(`Are you sure you want to complete the consultation for ${activePatient.name}? This will finalize the clinical examination and route the patient to the next step.`)) {
      return;
    }
    
    // Check NHIF service gate
    if (activePatient.insuranceType === InsuranceType.NHIF && currentVisitId) {
      const gateResult = await canStartConsultation(currentVisitId);
      if (!gateResult.allowed) {
        showError(gateResult.reason || 'NHIF verification required before completing consultation');
        return;
      }
    }
    
    if (!chiefComplaint.trim()) {
      showError('Chief Complaint is required');
      return;
    }

    // Determine next status based on prescription and plan
    // Check if prescription is filled (optical needs - glasses/lenses)
    const hasPrescription = prescriptionOD.trim() || prescriptionOS.trim() || prescriptionAddOD.trim() || prescriptionAddOS.trim() ||
                           sphereOD.trim() || sphereOS.trim() || cylinderOD.trim() || cylinderOS.trim();
    
    // Check if medications are needed (pharmacy needs)
    const hasMedicationPrescriptions = medicationPrescriptions.length > 0 && 
                                      medicationPrescriptions.some(med => med.medication.trim() !== '');
    const planLower = plan.toLowerCase();
    const planMentionsMedications = planLower.includes('medication') || 
                                    planLower.includes('drops') || 
                                    planLower.includes('eye drops') ||
                                    planLower.includes('prescribe') ||
                                    planLower.includes('prescription') ||
                                    planLower.includes('ointment') ||
                                    planLower.includes('tablet');
    const needsMedications = hasMedicationPrescriptions || planMentionsMedications;

    // Determine routing based on patient needs:
    // Priority: Optical → Pharmacy → Billing
    // 1. If prescription filled → IN_OPTICAL (for glasses/lenses)
    // 2. If medications needed (but no prescription) → IN_PHARMACY
    // 3. If both → IN_OPTICAL first (pharmacist can check optical queue after)
    // 4. If neither → PENDING_BILLING
    let nextStatus: PatientStatus;
    let successMessage: string;

    if (hasPrescription) {
      // Has optical prescription - route to Optical Dispensing
      nextStatus = PatientStatus.IN_OPTICAL;
      if (needsMedications) {
        successMessage = 'Clinical Session Completed. Patient routed to Optical Dispensing for glasses. After optical, patient will proceed to Pharmacy for medications.';
      } else {
        successMessage = 'Clinical Session Completed. Patient routed to Optical Dispensing for glasses.';
      }
    } else if (needsMedications) {
      // Only medications needed (no optical prescription)
      nextStatus = PatientStatus.IN_PHARMACY;
      successMessage = 'Clinical Session Completed. Patient routed to Pharmacy for medications.';
    } else {
      // No prescription or medications - go directly to billing
      nextStatus = PatientStatus.PENDING_BILLING;
      successMessage = 'Clinical Session Completed. Patient routed to Billing.';
    }

    // Build comprehensive consultation notes
    const consultationNotesParts = [
      `HPI: ${historyPresentIllness}`,
      `\n\nVISUAL ACUITY:`,
      `Distance: OD ${visualAcuityDistanceOD || 'N/A'} OS ${visualAcuityDistanceOS || 'N/A'}`,
      `Near: OD ${visualAcuityNearOD || 'N/A'} OS ${visualAcuityNearOS || 'N/A'}`,
      `Pinhole: OD ${visualAcuityPinholeOD || 'N/A'} OS ${visualAcuityPinholeOS || 'N/A'}`,
      `\n\nREFRACTION:`,
      `OD: ${refractionOD || 'N/A'}, OS: ${refractionOS || 'N/A'}`,
      `Add: OD ${addOD || 'N/A'} OS ${addOS || 'N/A'}`,
      `\n\nPUPILS:`,
      `General: ${pupils || 'N/A'}`,
      `Size: OD ${pupilSizeOD || 'N/A'}mm OS ${pupilSizeOS || 'N/A'}mm`,
      `Reactivity: OD ${pupilReactivityOD || 'N/A'} OS ${pupilReactivityOS || 'N/A'}`,
      `\n\nEOM: ${extraocularMovements || 'N/A'}`,
      `\n\nIOP: OD ${intraocularPressureOD || 'N/A'} OS ${intraocularPressureOS || 'N/A'} (Method: ${tonometryMethod || 'N/A'})`,
      `Dilated: ${isDilated ? 'Yes' : 'No'}`,
      `\n\nANTERIOR SEGMENT: ${anteriorSegment || 'N/A'}`,
      `\n\nPOSTERIOR SEGMENT: ${posteriorSegment || 'N/A'}`,
      `\n\nSLIT LAMP: ${slitLampFindings || 'N/A'}`,
      `\n\nADDITIONAL TESTS:`,
      `Visual Field: ${visualField || 'N/A'}`,
      `Color Vision: ${colorVision || 'N/A'}`,
      `Cover Test: ${coverTest || 'N/A'}`,
      `Stereopsis: ${stereopsis || 'N/A'}`,
      `Accommodation: ${accommodation || 'N/A'}`,
      `Convergence: ${convergence || 'N/A'}`
    ];

    const clinicalNotesParts = [
      `Past Ocular History: ${pastOcularHistory || 'N/A'}`,
      `Family History: ${familyHistory || 'N/A'}`,
      `Social History: ${socialHistory || 'N/A'}`,
      `Systemic History: ${systemicHistory || 'N/A'}`,
      `Current Medications: ${medications || 'N/A'}`,
      `Allergies: ${allergies || 'N/A'}`
    ];

    // Build prescription object with professional format
    const prescriptionData: any = {
      od: prescriptionOD || `${sphereOD || ''} ${cylinderOD ? `/${cylinderOD}` : ''} ${axisOD ? `x${axisOD}` : ''}`.trim(),
      os: prescriptionOS || `${sphereOS || ''} ${cylinderOS ? `/${cylinderOS}` : ''} ${axisOS ? `x${axisOS}` : ''}`.trim(),
      addOd: prescriptionAddOD,
      addOs: prescriptionAddOS,
      sphereOD,
      sphereOS,
      cylinderOD,
      cylinderOS,
      axisOD,
      axisOS,
      prismOD,
      prismOS,
      baseOD,
      baseOS,
      pupillaryDistance,
      segmentHeight,
      lensType
    };

    // Add medication prescriptions if any
    if (medicationPrescriptions.length > 0) {
      prescriptionData.medications = medicationPrescriptions.map(med => ({
        name: med.medication,
        strength: med.strength,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        route: med.route,
        instructions: med.instructions
      }));
    }

    const result = await updatePatient(selectedPatientId, {
      status: nextStatus,
      chiefComplaint: chiefComplaint,
      clinicalNotes: clinicalNotesParts.join('\n'),
      consultationNotes: consultationNotesParts.join('\n'),
      diagnosis: diagnosis,
      prescription: prescriptionData,
      billItems: [
        ...activePatient.billItems,
        { 
          id: generateBillItemId(), 
          description: 'Comprehensive Eye Examination Fee', 
          amount: CLINICAL_FEES.COMPREHENSIVE_EXAMINATION, 
          category: 'CLINICAL', 
          isCoveredByNHIF: true, 
          isCoveredByPrivate: true 
        }
      ]
    });
    
      if (result.success) {
        // Log consultation completion
        await logCriticalOperation(
          'COMPLETE_CONSULTATION',
          'PATIENT',
          selectedPatientId,
          {
            patientName: activePatient.name,
            nextStatus: nextStatus,
            hasPrescription: hasPrescription,
            hasMedications: needsMedications,
            diagnosis: diagnosis,
          }
        );

        showSuccess(successMessage);
        setSelectedPatientId(null);
      resetForm();
    } else {
      showError(result.error || 'Failed to complete clinical session');
    }
  };

  const resetForm = () => {
    setChiefComplaint('');
    setHistoryPresentIllness('');
    setPastOcularHistory('');
    setFamilyHistory('');
    setMedications('');
    setAllergies('');
    setSocialHistory('');
    setSystemicHistory('');
    setVisualAcuityDistanceOD('');
    setVisualAcuityDistanceOS('');
    setVisualAcuityNearOD('');
    setVisualAcuityNearOS('');
    setVisualAcuityPinholeOD('');
    setVisualAcuityPinholeOS('');
    setRefractionOD('');
    setRefractionOS('');
    setAddOD('');
    setAddOS('');
    setPupils('');
    setPupilSizeOD('');
    setPupilSizeOS('');
    setPupilReactivityOD('');
    setPupilReactivityOS('');
    setExtraocularMovements('');
    setAnteriorSegment('');
    setPosteriorSegment('');
    setIntraocularPressureOD('');
    setIntraocularPressureOS('');
    setTonometryMethod('');
    setIsDilated(false);
    setVisualField('');
    setColorVision('');
    setCoverTest('');
    setStereopsis('');
    setAccommodation('');
    setConvergence('');
    setSlitLampFindings('');
    setDiagnosis('');
    setIcd10Code('');
    setPlan('');
    setFollowUp('');
    setPrescriptionOD('');
    setPrescriptionOS('');
    setPrescriptionAddOD('');
    setPrescriptionAddOS('');
    setSphereOD('');
    setSphereOS('');
    setCylinderOD('');
    setCylinderOS('');
    setAxisOD('');
    setAxisOS('');
    setPrismOD('');
    setPrismOS('');
    setBaseOD('');
    setBaseOS('');
    setPupillaryDistance('');
    setSegmentHeight('');
    setLensType('');
    setMedicationPrescriptions([]);
    setAiInsights('');
    setPrescriptionErrors({});
  };

  // Medication Prescription Management
  const handleAddMedication = () => {
    setMedicationPrescriptions([
      ...medicationPrescriptions,
      {
        id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        medication: '',
        strength: '',
        dosage: '',
        frequency: '',
        duration: '',
        route: 'Ophthalmic',
        instructions: ''
      }
    ]);
  };

  const handleRemoveMedication = (id: string) => {
    const medication = medicationPrescriptions.find(med => med.id === id);
    if (!confirm(`Are you sure you want to remove ${medication?.medication || 'this medication'} from the prescription?`)) {
      return;
    }
    setMedicationPrescriptions(medicationPrescriptions.filter(med => med.id !== id));
  };

  const handleUpdateMedication = (id: string, field: string, value: string) => {
    const sanitized = sanitizeInput(value, true);
    setMedicationPrescriptions(medicationPrescriptions.map(med => 
      med.id === id ? { ...med, [field]: sanitized } : med
    ));
  };

  // Get patients waiting for clinical or currently in clinical
  // EMR is patient-focused, not appointment-focused
  const clinicalQueue = patients
    .filter(p => p.status === PatientStatus.WAITING || p.status === PatientStatus.IN_CLINICAL)
    .sort((a, b) => {
      // Prioritize IN_CLINICAL over WAITING
      if (a.status === PatientStatus.IN_CLINICAL && b.status === PatientStatus.WAITING) return -1;
      if (a.status === PatientStatus.WAITING && b.status === PatientStatus.IN_CLINICAL) return 1;
      // Then by check-in time (most recent first)
      const timeA = new Date(a.checkedInAt).getTime();
      const timeB = new Date(b.checkedInAt).getTime();
      return timeB - timeA;
    });

  const handleStartAttending = async (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    // Load patient data into form
    setSelectedPatientId(patient.id);
    setChiefComplaint(patient.chiefComplaint || '');
    setPastOcularHistory(patient.clinicalNotes || '');
    setDiagnosis(patient.diagnosis || '');
    setPrescriptionOD(patient.prescription?.od || '');
    setPrescriptionOS(patient.prescription?.os || '');
    setPrescriptionAddOD(patient.prescription?.addOd || patient.prescription?.add || '');
    setPrescriptionAddOS(patient.prescription?.addOs || patient.prescription?.add || '');

    // Auto-update status to IN_CLINICAL when patient is selected
    if (patient.status === PatientStatus.WAITING) {
      await updatePatient(patient.id, { status: PatientStatus.IN_CLINICAL });
      showSuccess(`Started attending ${patient.name}`);
    }
  };

  // If no patient selected, show empty state
  if (!selectedPatientId || !activePatient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
          <i className="fas fa-file-medical text-4xl text-slate-300"></i>
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight">Electronic Medical Record</h3>
        <p className="text-sm text-slate-500 font-medium max-w-sm mb-4">
          Select a patient from the Appointments page to open their EMR and start clinical examination.
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <i className="fas fa-info-circle"></i>
          <span>Go to Appointments page to select a patient</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto">
      {/* Minimal Patient Header - Just Name and ID */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary-50 text-brand-primary rounded-xl flex items-center justify-center font-bold text-sm shadow-inner border border-brand-primary-100">
              {activePatient.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">{activePatient.name}</h2>
              <p className="text-xs text-slate-500 font-medium font-mono">ID: {activePatient.id}</p>
            </div>
          </div>
          {/* NHIF Badge in Header */}
          {activePatient.insuranceType === InsuranceType.NHIF && currentVisitId && (
            <NHIFVerificationBadge visitId={currentVisitId} compact />
          )}
          <div className="flex gap-3">
            <button 
              onClick={handleAiInsight} 
              className="px-4 py-2 bg-brand-primary-dark text-white rounded-xl text-xs font-semibold uppercase tracking-wide flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-brand-primary/20" 
              disabled={isAiLoading}
            >
              <i className={`fas ${isAiLoading ? 'fa-spinner fa-spin' : 'fa-brain'} text-brand-primary-light`}></i>
              AI Insights
            </button>
            <button className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold uppercase tracking-wide flex items-center gap-2 hover:bg-white transition-all">
              <i className="fas fa-history text-brand-primary"></i>
              History
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive EMR Form - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pb-4">
        {/* History Section */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fas fa-history text-brand-primary"></i>
            History
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                Chief Complaint <span className="text-red-500">*</span>
              </label>
              <textarea 
                required 
                value={chiefComplaint} 
                onChange={(e) => handleTextChange(setChiefComplaint, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Patient's main concern or reason for visit..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-20" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600">History of Present Illness (HPI)</label>
              <textarea 
                value={historyPresentIllness} 
                onChange={(e) => handleTextChange(setHistoryPresentIllness, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Onset, duration, severity, associated symptoms..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-24" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Past Ocular History</label>
              <textarea 
                value={pastOcularHistory} 
                onChange={(e) => handleTextChange(setPastOcularHistory, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Previous eye conditions, surgeries, treatments..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-24" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Family History</label>
              <textarea 
                value={familyHistory} 
                onChange={(e) => handleTextChange(setFamilyHistory, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Family history of eye diseases (glaucoma, macular degeneration, etc.)..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-24" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Current Medications</label>
              <textarea 
                value={medications} 
                onChange={(e) => handleTextChange(setMedications, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="List current medications..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-20" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Allergies</label>
              <textarea 
                value={allergies} 
                onChange={(e) => handleTextChange(setAllergies, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Known allergies (medications, eye drops, etc.)..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-20" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Social History</label>
              <textarea 
                value={socialHistory} 
                onChange={(e) => handleTextChange(setSocialHistory, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Smoking, alcohol, occupation, hobbies..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-20" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Systemic History</label>
              <textarea 
                value={systemicHistory} 
                onChange={(e) => handleTextChange(setSystemicHistory, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Diabetes, hypertension, autoimmune diseases, etc." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-20" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
          </div>
        </div>

        {/* Examination Section */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fas fa-eye text-emerald-600"></i>
            Examination
          </h3>
          
          {/* Visual Acuity */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Visual Acuity</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Distance VA - OD</label>
                <input 
                  type="text"
                  value={visualAcuityDistanceOD} 
                  onChange={(e) => setVisualAcuityDistanceOD(e.target.value)} 
                  placeholder="20/20" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Distance VA - OS</label>
                <input 
                  type="text"
                  value={visualAcuityDistanceOS} 
                  onChange={(e) => setVisualAcuityDistanceOS(e.target.value)} 
                  placeholder="20/20" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Near VA - OD</label>
                <input 
                  type="text"
                  value={visualAcuityNearOD} 
                  onChange={(e) => setVisualAcuityNearOD(e.target.value)} 
                  placeholder="N6" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Near VA - OS</label>
                <input 
                  type="text"
                  value={visualAcuityNearOS} 
                  onChange={(e) => setVisualAcuityNearOS(e.target.value)} 
                  placeholder="N6" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Pinhole VA - OD</label>
                <input 
                  type="text"
                  value={visualAcuityPinholeOD} 
                  onChange={(e) => setVisualAcuityPinholeOD(e.target.value)} 
                  placeholder="20/20" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Pinhole VA - OS</label>
                <input 
                  type="text"
                  value={visualAcuityPinholeOS} 
                  onChange={(e) => setVisualAcuityPinholeOS(e.target.value)} 
                  placeholder="20/20" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
            </div>
          </div>

          {/* Refraction */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Refraction</h4>
            <div className="bg-slate-900 rounded-xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-brand-primary-light text-center block">OD</label>
                  <input 
                    type="text"
                    value={refractionOD} 
                    onChange={(e) => setRefractionOD(e.target.value)} 
                    placeholder="-2.00 DS" 
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white focus:border-brand-primary outline-none text-center transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-brand-primary-light text-center block">OS</label>
                  <input 
                    type="text"
                    value={refractionOS} 
                    onChange={(e) => setRefractionOS(e.target.value)} 
                    placeholder="-2.25 DS" 
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white focus:border-brand-primary outline-none text-center transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-emerald-400 text-center block">Add OD</label>
                  <input 
                    type="text"
                    value={addOD} 
                    onChange={(e) => setAddOD(e.target.value)} 
                    placeholder="+2.00" 
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white focus:border-emerald-500 outline-none text-center transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-emerald-400 text-center block">Add OS</label>
                  <input 
                    type="text"
                    value={addOS} 
                    onChange={(e) => setAddOS(e.target.value)} 
                    placeholder="+2.00" 
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white focus:border-emerald-500 outline-none text-center transition-all" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Other Examinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Pupils (General)</label>
              <input 
                type="text"
                value={pupils} 
                onChange={(e) => setPupils(e.target.value)} 
                placeholder="PERRLA, round, regular..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Pupil Size</label>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text"
                  value={pupilSizeOD} 
                  onChange={(e) => setPupilSizeOD(e.target.value)} 
                  placeholder="OD (mm)" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
                <input 
                  type="text"
                  value={pupilSizeOS} 
                  onChange={(e) => setPupilSizeOS(e.target.value)} 
                  placeholder="OS (mm)" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Pupil Reactivity</label>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text"
                  value={pupilReactivityOD} 
                  onChange={(e) => setPupilReactivityOD(e.target.value)} 
                  placeholder="OD (Direct/Consensual)" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
                <input 
                  type="text"
                  value={pupilReactivityOS} 
                  onChange={(e) => setPupilReactivityOS(e.target.value)} 
                  placeholder="OS (Direct/Consensual)" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Extraocular Movements (EOM)</label>
              <input 
                type="text"
                value={extraocularMovements} 
                onChange={(e) => setExtraocularMovements(e.target.value)} 
                placeholder="Full, restricted, nystagmus..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Intraocular Pressure (IOP)</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input 
                  type="text"
                  value={intraocularPressureOD} 
                  onChange={(e) => setIntraocularPressureOD(e.target.value)} 
                  placeholder="OD (mmHg)" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
                <input 
                  type="text"
                  value={intraocularPressureOS} 
                  onChange={(e) => setIntraocularPressureOS(e.target.value)} 
                  placeholder="OS (mmHg)" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="text-xs font-semibold text-slate-600">Tonometry Method:</label>
                <select
                  value={tonometryMethod}
                  onChange={(e) => setTonometryMethod(e.target.value)}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                >
                  <option value="">Select Method</option>
                  <option value="Goldmann Applanation">Goldmann Applanation</option>
                  <option value="Non-Contact Tonometry (NCT)">Non-Contact Tonometry (NCT)</option>
                  <option value="Tono-Pen">Tono-Pen</option>
                  <option value="iCare">iCare</option>
                  <option value="Pneumatonometry">Pneumatonometry</option>
                </select>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input 
                    type="checkbox"
                    checked={isDilated}
                    onChange={(e) => setIsDilated(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                  Dilated Exam
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Anterior Segment</label>
              <textarea 
                value={anteriorSegment} 
                onChange={(e) => handleTextChange(setAnteriorSegment, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Cornea, iris, lens findings..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-20" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600">Posterior Segment</label>
              <textarea 
                value={posteriorSegment} 
                onChange={(e) => handleTextChange(setPosteriorSegment, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Fundus, retina, macula, optic disc findings..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-24" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600">Slit Lamp Findings</label>
              <textarea 
                value={slitLampFindings} 
                onChange={(e) => handleTextChange(setSlitLampFindings, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Detailed slit lamp examination findings (cornea, anterior chamber, iris, lens)..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-24" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
          </div>

          {/* Additional Tests */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Additional Tests</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Visual Field</label>
                <input 
                  type="text"
                  value={visualField} 
                  onChange={(e) => setVisualField(e.target.value)} 
                  placeholder="Visual field testing results..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Color Vision</label>
                <input 
                  type="text"
                  value={colorVision} 
                  onChange={(e) => setColorVision(e.target.value)} 
                  placeholder="Ishihara, color vision test results..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Cover Test</label>
                <input 
                  type="text"
                  value={coverTest} 
                  onChange={(e) => setCoverTest(e.target.value)} 
                  placeholder="Cover/uncover test, phoria, tropia..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Stereopsis</label>
                <input 
                  type="text"
                  value={stereopsis} 
                  onChange={(e) => setStereopsis(e.target.value)} 
                  placeholder="Stereopsis test results (arc seconds)..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Accommodation</label>
                <input 
                  type="text"
                  value={accommodation} 
                  onChange={(e) => setAccommodation(e.target.value)} 
                  placeholder="Accommodation amplitude, facility..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Convergence</label>
                <input 
                  type="text"
                  value={convergence} 
                  onChange={(e) => setConvergence(e.target.value)} 
                  placeholder="Near point of convergence (NPC)..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Assessment & Plan */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fas fa-clipboard-check text-purple-600"></i>
            Assessment & Plan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Diagnosis</label>
                <button
                  onClick={handleDiagnosisSuggestion}
                  disabled={isDiagnosisAiLoading || !chiefComplaint.trim()}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  title="Get AI diagnosis suggestion"
                >
                  <i className={`fas ${isDiagnosisAiLoading ? 'fa-spinner fa-spin' : 'fa-brain'}`}></i>
                  AI Suggest
                </button>
              </div>
              <textarea 
                value={diagnosis} 
                onChange={(e) => handleTextChange(setDiagnosis, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Primary diagnosis and any secondary conditions..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-24" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">ICD-10 Code</label>
                <button
                  onClick={handleICD10Suggestion}
                  disabled={isIcd10AiLoading || !diagnosis.trim()}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  title="Get AI ICD-10 code suggestion"
                >
                  <i className={`fas ${isIcd10AiLoading ? 'fa-spinner fa-spin' : 'fa-brain'}`}></i>
                  AI Suggest
                </button>
              </div>
              <select
                value={icd10Code}
                onChange={(e) => setIcd10Code(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
              >
                <option value="">{isLoadingIcd10 ? 'Loading ICD-10 codes...' : 'Select ICD-10 Code'}</option>
                {icd10Codes.map(code => (
                  <option key={code.code} value={code.code}>{code.code} - {code.description}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Follow-up</label>
              <input 
                type="text"
                value={followUp} 
                onChange={(e) => handleTextChange(setFollowUp, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="e.g., 3 months, 6 weeks..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Plan / Treatment</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMedicationSuggestion}
                    disabled={isMedicationAiLoading || !diagnosis.trim()}
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    title="Get AI medication suggestions"
                  >
                    <i className={`fas ${isMedicationAiLoading ? 'fa-spinner fa-spin' : 'fa-pills'}`}></i>
                    Medications
                  </button>
                  <button
                    onClick={handleTreatmentPlanSuggestion}
                    disabled={isTreatmentAiLoading || !diagnosis.trim()}
                    className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    title="Get AI treatment plan suggestion"
                  >
                    <i className={`fas ${isTreatmentAiLoading ? 'fa-spinner fa-spin' : 'fa-brain'}`}></i>
                    AI Suggest
                  </button>
                </div>
              </div>
              <textarea 
                value={plan} 
                onChange={(e) => handleTextChange(setPlan, e.target.value, VALIDATION_LIMITS.MAX_NOTES_LENGTH, true)} 
                placeholder="Treatment plan, medications prescribed, recommendations..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all h-24" 
                maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              />
            </div>
          </div>
        </div>

        {/* Spectacle/Correction Prescription - Professional Format */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fas fa-glasses text-indigo-600"></i>
            Spectacle/Correction Prescription
          </h3>
          
          {/* Professional Prescription Format */}
          <div className="bg-gradient-to-br from-brand-secondary-50 to-brand-primary-50 rounded-xl p-5 border border-brand-secondary-100 mb-4">
            <h4 className="text-sm font-semibold text-indigo-900 mb-4 text-center">Refractive Correction</h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Sphere (SPH) - OD</label>
                <input 
                  type="text"
                  value={sphereOD} 
                  onChange={(e) => setSphereOD(e.target.value)} 
                  placeholder="-2.00" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Sphere (SPH) - OS</label>
                <input 
                  type="text"
                  value={sphereOS} 
                  onChange={(e) => setSphereOS(e.target.value)} 
                  placeholder="-2.25" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Cylinder (CYL) - OD</label>
                <input 
                  type="text"
                  value={cylinderOD} 
                  onChange={(e) => setCylinderOD(e.target.value)} 
                  placeholder="-0.50" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Cylinder (CYL) - OS</label>
                <input 
                  type="text"
                  value={cylinderOS} 
                  onChange={(e) => setCylinderOS(e.target.value)} 
                  placeholder="-0.50" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Axis - OD</label>
                <input 
                  type="text"
                  value={axisOD} 
                  onChange={(e) => setAxisOD(e.target.value)} 
                  placeholder="180" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Axis - OS</label>
                <input 
                  type="text"
                  value={axisOS} 
                  onChange={(e) => setAxisOS(e.target.value)} 
                  placeholder="180" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Add (Near Addition) - OD</label>
                <input 
                  type="text"
                  value={prescriptionAddOD} 
                  onChange={(e) => handlePrescriptionChange('addOd', e.target.value)} 
                  placeholder="+2.00" 
                  maxLength={VALIDATION_LIMITS.MAX_PRESCRIPTION_LENGTH}
                  className={`w-full p-2.5 bg-white border rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all ${prescriptionErrors.addOd ? 'border-red-500' : 'border-indigo-200'}`} 
                />
                {prescriptionErrors.addOd && (
                  <p className="text-xs text-red-600 mt-1 text-center">{prescriptionErrors.addOd}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Add (Near Addition) - OS</label>
                <input 
                  type="text"
                  value={prescriptionAddOS} 
                  onChange={(e) => handlePrescriptionChange('addOs', e.target.value)} 
                  placeholder="+2.00" 
                  maxLength={VALIDATION_LIMITS.MAX_PRESCRIPTION_LENGTH}
                  className={`w-full p-2.5 bg-white border rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all ${prescriptionErrors.addOs ? 'border-red-500' : 'border-indigo-200'}`} 
                />
                {prescriptionErrors.addOs && (
                  <p className="text-xs text-red-600 mt-1 text-center">{prescriptionErrors.addOs}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Prism - OD</label>
                <input 
                  type="text"
                  value={prismOD} 
                  onChange={(e) => setPrismOD(e.target.value)} 
                  placeholder="2Δ BI" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Prism - OS</label>
                <input 
                  type="text"
                  value={prismOS} 
                  onChange={(e) => setPrismOS(e.target.value)} 
                  placeholder="2Δ BI" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Base - OD</label>
                <select
                  value={baseOD}
                  onChange={(e) => setBaseOD(e.target.value)}
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all"
                >
                  <option value="">Select</option>
                  <option value="BI">BI (Base In)</option>
                  <option value="BO">BO (Base Out)</option>
                  <option value="BU">BU (Base Up)</option>
                  <option value="BD">BD (Base Down)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Base - OS</label>
                <select
                  value={baseOS}
                  onChange={(e) => setBaseOS(e.target.value)}
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all"
                >
                  <option value="">Select</option>
                  <option value="BI">BI (Base In)</option>
                  <option value="BO">BO (Base Out)</option>
                  <option value="BU">BU (Base Up)</option>
                  <option value="BD">BD (Base Down)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Pupillary Distance (PD)</label>
                <input 
                  type="text"
                  value={pupillaryDistance} 
                  onChange={(e) => setPupillaryDistance(e.target.value)} 
                  placeholder="64mm" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-700 text-center block">Segment Height</label>
                <input 
                  type="text"
                  value={segmentHeight} 
                  onChange={(e) => setSegmentHeight(e.target.value)} 
                  placeholder="22mm" 
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all" 
                />
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-indigo-700">Lens Type</label>
              <select
                value={lensType}
                onChange={(e) => setLensType(e.target.value)}
                className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Select Lens Type</option>
                <option value="Single Vision">Single Vision</option>
                <option value="Bifocal - Flat Top">Bifocal - Flat Top</option>
                <option value="Bifocal - Round Top">Bifocal - Round Top</option>
                <option value="Progressive">Progressive</option>
                <option value="Trifocal">Trifocal</option>
                <option value="Computer/Office">Computer/Office</option>
              </select>
            </div>
          </div>

          {/* Legacy Prescription Format (for compatibility) */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-600 mb-3">Quick Prescription Format (Legacy)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 text-center block">OD</label>
                <input 
                  type="text"
                  value={prescriptionOD} 
                  onChange={(e) => handlePrescriptionChange('od', e.target.value)} 
                  placeholder="-2.00 DS" 
                  maxLength={VALIDATION_LIMITS.MAX_PRESCRIPTION_LENGTH}
                  className={`w-full p-3 bg-white border rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all ${prescriptionErrors.od ? 'border-red-500' : 'border-slate-200'}`} 
                />
                {prescriptionErrors.od && (
                  <p className="text-xs text-red-600 mt-1 text-center">{prescriptionErrors.od}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 text-center block">OS</label>
                <input 
                  type="text"
                  value={prescriptionOS} 
                  onChange={(e) => handlePrescriptionChange('os', e.target.value)} 
                  placeholder="-2.25 DS" 
                  maxLength={VALIDATION_LIMITS.MAX_PRESCRIPTION_LENGTH}
                  className={`w-full p-3 bg-white border rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none text-center transition-all ${prescriptionErrors.os ? 'border-red-500' : 'border-slate-200'}`} 
                />
                {prescriptionErrors.os && (
                  <p className="text-xs text-red-600 mt-1 text-center">{prescriptionErrors.os}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Medication Prescription */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fas fa-pills text-emerald-600"></i>
            Medication Prescription
          </h3>
          
          {medicationPrescriptions.length > 0 && (
            <div className="space-y-4 mb-4">
              {medicationPrescriptions.map((med, index) => (
                <div key={med.id} className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-emerald-900">Medication #{index + 1}</h4>
                    <button
                      onClick={() => handleRemoveMedication(med.id)}
                      className="text-red-600 hover:text-red-700 text-xs font-semibold px-3 py-1.5 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-all"
                    >
                      <i className="fas fa-trash mr-1"></i>Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-emerald-700">Medication Name</label>
                      <input 
                        type="text"
                        value={med.medication} 
                        onChange={(e) => handleUpdateMedication(med.id, 'medication', e.target.value)} 
                        placeholder="e.g., Timolol Maleate" 
                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-sm font-normal text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-emerald-700">Strength/Concentration</label>
                      <input 
                        type="text"
                        value={med.strength} 
                        onChange={(e) => handleUpdateMedication(med.id, 'strength', e.target.value)} 
                        placeholder="e.g., 0.5%" 
                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-sm font-normal text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-emerald-700">Dosage/Form</label>
                      <input 
                        type="text"
                        value={med.dosage} 
                        onChange={(e) => handleUpdateMedication(med.id, 'dosage', e.target.value)} 
                        placeholder="e.g., 5ml, 1 tablet" 
                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-sm font-normal text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-emerald-700">Frequency</label>
                      <input 
                        type="text"
                        value={med.frequency} 
                        onChange={(e) => handleUpdateMedication(med.id, 'frequency', e.target.value)} 
                        placeholder="e.g., 2x daily, QID, TID" 
                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-sm font-normal text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-emerald-700">Duration</label>
                      <input 
                        type="text"
                        value={med.duration} 
                        onChange={(e) => handleUpdateMedication(med.id, 'duration', e.target.value)} 
                        placeholder="e.g., 7 days, 2 weeks" 
                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-sm font-normal text-slate-900 focus:border-emerald-500 outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-emerald-700">Route of Administration</label>
                      <select
                        value={med.route}
                        onChange={(e) => handleUpdateMedication(med.id, 'route', e.target.value)}
                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-sm font-normal text-slate-900 focus:border-emerald-500 outline-none transition-all"
                      >
                        <option value="Ophthalmic">Ophthalmic (Eye Drops)</option>
                        <option value="Oral">Oral</option>
                        <option value="Topical">Topical</option>
                        <option value="Intramuscular">Intramuscular (IM)</option>
                        <option value="Intravenous">Intravenous (IV)</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-semibold text-emerald-700">Special Instructions</label>
                      <textarea 
                        value={med.instructions} 
                        onChange={(e) => handleUpdateMedication(med.id, 'instructions', e.target.value)} 
                        placeholder="Special instructions, warnings, or notes..." 
                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-sm font-normal text-slate-900 focus:border-emerald-500 outline-none transition-all h-20" 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={handleAddMedication}
            className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Add Medication
          </button>
        </div>
      </div>

      {/* Action Buttons - Fixed at Bottom */}
      <div className="bg-slate-900 p-4 flex justify-between items-center rounded-xl shadow-lg border border-slate-800 flex-shrink-0">
        <button className="text-red-400 text-xs font-semibold uppercase tracking-wide px-6 py-2 hover:bg-red-950/30 rounded-xl transition-all border border-red-900/20">
          Flag for Referral
        </button>
        <div className="flex gap-4">
          <button 
            onClick={handleComplete} 
            className="px-10 py-3.5 text-white font-semibold uppercase tracking-wide text-sm rounded-xl shadow-xl active:scale-95 transition-all"
            style={{
              backgroundColor: 'var(--brand-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
            }}
          >
            Complete Clinical Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default Clinical;
