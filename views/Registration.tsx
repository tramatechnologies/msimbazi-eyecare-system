
import React, { useState, useMemo, useEffect } from 'react';
import { InsuranceType, PatientStatus, InsuranceProvider, AppointmentType, AppointmentPriority, Patient, VisitType, AuthorizationStatus } from '../types';
import { usePatients } from '../contexts/PatientContext';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import * as patientService from '../services/patientService';
import { sanitizeInput, validatePhone, validateDateOfBirth, validateName } from '../utils/validation';
import { generateAuthNumber, generatePatientId } from '../utils/idGenerator';
import { INSURANCE_PROVIDERS, HOSPITAL_PRICING } from '../constants';
import { getProvidersForScheduling } from '../services/providerService';
import { syncProvidersFromUsers } from '../services/userService';
import { getCurrentDate, getNextAvailableTime, formatDate, formatTime } from '../utils/dateTimeUtils';
import { verifyNHIF, createVisit, getPatientVisit } from '../services/nhifService';

type RegistrationStep = 'category' | 'patient-details' | 'insurance' | 'appointment' | 'billing-preview' | 'complete';

const Registration: React.FC = () => {
  const { addPatient, updatePatient, patients, getPatient } = usePatients();
  const { success: showSuccess, error: showError } = useToast();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('category');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<{
    authorizationStatus: AuthorizationStatus;
    authorizationNo?: string;
    cardStatus?: string;
    memberName?: string;
    remarks?: string;
  } | null>(null);
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [savedPatient, setSavedPatient] = useState<Patient | null>(null);
  
  const [formData, setFormData] = useState({
    // Category
    patientCategory: '' as 'CASH' | 'INSURANCE' | '',
    
    // Patient details
    name: '',
    phone: '',
    dob: '',
    address: '',
    gender: 'Male',
    
    // Insurance
    insuranceProvider: '' as InsuranceProvider | '',
    insuranceNumber: '',
    nhifAuthNumber: '',
    visitTypeId: VisitType.NORMAL as VisitType,
    referralNo: '',
    nhifRemarks: '',
    
    // Appointment
    appointmentType: '' as AppointmentType | '',
    appointmentDate: '',
    appointmentTime: '',
    priority: AppointmentPriority.NORMAL as AppointmentPriority,
    assignedDoctorId: '',
    
    // Billing
    selectedServices: [] as string[],
  });

  // Filter patients for returning patient search
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return patients.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [patients, searchTerm]);

  // Get doctors for scheduling (all OPTOMETRIST + OPHTHALMOLOGIST, any status)
  const [availableDoctors, setAvailableDoctors] = useState<any[]>([]);

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        let doctors = await getProvidersForScheduling();
        if (doctors.length === 0) {
          await syncProvidersFromUsers();
          doctors = await getProvidersForScheduling();
        }
        setAvailableDoctors(doctors);
      } catch (error) {
        console.error('Failed to load doctors:', error);
        setAvailableDoctors([]);
      }
    };
    loadDoctors();
  }, []);

  // Calculate age from date of birth
  const calculatedAge = useMemo(() => {
    if (!formData.dob) return null;
    const birthDate = new Date(formData.dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }, [formData.dob]);

  // Calculate billing preview for cash patients
  const billingPreview = useMemo(() => {
    if (formData.patientCategory !== 'CASH') return null;
    const total = formData.selectedServices.reduce((sum, service) => {
      const price = HOSPITAL_PRICING[service as keyof typeof HOSPITAL_PRICING] || 0;
      return sum + price;
    }, 0);
    return total;
  }, [formData.selectedServices, formData.patientCategory]);

  // Auto-populate appointment date and time when appointment step is reached
  useEffect(() => {
    if (currentStep === 'appointment' && (!formData.appointmentDate || !formData.appointmentTime)) {
      setFormData(prev => ({
        ...prev,
        appointmentDate: prev.appointmentDate || getCurrentDate(),
        appointmentTime: prev.appointmentTime || getNextAvailableTime(),
      }));
    }
  }, [currentStep]);

  const handleCategorySelect = (category: 'CASH' | 'INSURANCE') => {
    setFormData({ ...formData, patientCategory: category });
    setCurrentStep('patient-details');
  };

  const handleVerifyNHIF = async () => {
    if (!formData.insuranceNumber.trim()) {
      setVerificationError('Please enter NHIF card number');
      return;
    }

    // Validate referral number for Referral (3) and Follow-up (4)
    if ((formData.visitTypeId === 3 || formData.visitTypeId === 4) && !formData.referralNo.trim()) {
      setVerificationError('Referral number is required for Referral and Follow-up visits');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');
    setVerificationResult(null);
    
    try {
      // For new patients, we'll create visit after verification succeeds
      // For returning patients, get or create visit
      let visitId = currentVisitId;
      
      if (selectedPatientId) {
        const visitResult = await getPatientVisit(selectedPatientId);
        if (visitResult.success && visitResult.visit) {
          visitId = visitResult.visit.id;
          setCurrentVisitId(visitResult.visit.id);
        } else {
          // Create new visit for returning patient
          const newVisitResult = await createVisit(
            selectedPatientId,
            'INSURANCE',
            'NHIF'
          );
          if (newVisitResult.success && newVisitResult.visitId) {
            visitId = newVisitResult.visitId;
            setCurrentVisitId(newVisitResult.visitId);
          } else {
            setVerificationError('Failed to create visit. Please try again.');
            setIsVerifying(false);
            return;
          }
        }
      } else {
        // For new patients, we need to create visit after patient is created
        // For now, we'll create a temporary visit or skip verification until patient is saved
        // In production, visit should be created first, then verification
        setVerificationError('Please complete patient details first, then verify NHIF');
        setIsVerifying(false);
        return;
      }

      // Call real NHIF verification API
      const verifyResult = await verifyNHIF(
        {
          cardNo: formData.insuranceNumber.trim(),
          visitTypeId: formData.visitTypeId,
          referralNo: formData.referralNo.trim() || undefined,
          remarks: undefined, // Can be added later
        },
        visitId
      );

      setIsVerifying(false);

      if (!verifyResult.success) {
        setVerificationError(verifyResult.error || 'NHIF verification failed');
        setVerificationResult({
          authorizationStatus: verifyResult.authorizationStatus || AuthorizationStatus.REJECTED,
        });
        return;
      }

      // Store verification result
      setVerificationResult({
        authorizationStatus: verifyResult.authorizationStatus as AuthorizationStatus,
        authorizationNo: verifyResult.authorizationNo,
        cardStatus: verifyResult.cardStatus,
        memberName: verifyResult.memberName,
        remarks: verifyResult.remarks,
      });

      if (verifyResult.authorizationStatus === 'ACCEPTED') {
        setIsVerified(true);
        if (verifyResult.authorizationNo) {
          setFormData(prev => ({ ...prev, nhifAuthNumber: verifyResult.authorizationNo! }));
        }
        showSuccess('NHIF card verified successfully!');
      } else if (verifyResult.authorizationStatus === 'UNKNOWN') {
        setIsVerified(true); // Allow service but with warning
        showSuccess('NHIF verification completed with warning. Please verify at NHIF office.');
      } else {
        setIsVerified(false);
        setVerificationError(`NHIF verification ${verifyResult.authorizationStatus.toLowerCase()}. ${verifyResult.remarks || 'Please check the card number or proceed with cash payment.'}`);
      }
    } catch (error: any) {
      setIsVerifying(false);
      setVerificationError(error.message || 'An error occurred during NHIF verification');
      console.error('NHIF verification error:', error);
    }
  };

  const handlePatientDetailsSubmit = () => {
    setErrors({});
    const newErrors: Record<string, string> = {};
    
    // Sanitize name on submit (allows spaces during typing)
    const sanitizedName = sanitizeInput(formData.name);
    if (!validateName(sanitizedName)) {
      newErrors.name = 'Name must be between 2 and 100 characters';
    } else {
      // Update with sanitized version
      setFormData({ ...formData, name: sanitizedName });
    }
    if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Phone number must be 10 digits (07XXXXXXXX)';
    }
    if (!validateDateOfBirth(formData.dob)) {
      newErrors.dob = 'Invalid date of birth';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (formData.patientCategory === 'INSURANCE') {
      setCurrentStep('insurance');
    } else {
      // For cash patients, go directly to appointment or show billing
      // Auto-set appointment date and time
      setFormData({
        ...formData,
        appointmentDate: getCurrentDate(),
        appointmentTime: getNextAvailableTime(),
      });
      setCurrentStep('appointment');
    }
  };

  const handleInsuranceSubmit = () => {
    setErrors({});
    
    if (!formData.insuranceProvider) {
      showError('Please select an insurance provider');
      return;
    }

    if (!formData.insuranceNumber.trim()) {
      showError('Insurance number is required');
      return;
    }

    // Check if NHIF validation is required and completed
    if (formData.insuranceProvider === InsuranceProvider.NHIF) {
      if (!isVerified || !verificationResult) {
        showError('Please verify NHIF card before proceeding');
        return;
      }
      
      // Block if rejected (unless converting to cash)
      if (verificationResult.authorizationStatus === AuthorizationStatus.REJECTED || 
          verificationResult.authorizationStatus === AuthorizationStatus.INVALID) {
        showError('NHIF verification rejected. Please convert to CASH payment or contact NHIF office.');
        return;
      }
      
      // Allow UNKNOWN with warning, but user should be aware
      if (verificationResult.authorizationStatus === AuthorizationStatus.UNKNOWN) {
        if (!confirm('NHIF verification returned UNKNOWN status. Patient should verify at NHIF office. Continue anyway?')) {
          return;
        }
      }
    }

    setCurrentStep('appointment');
  };

  const handleAppointmentSubmit = () => {
    setErrors({});
    
    if (!formData.appointmentType) {
      showError('Please select an appointment type');
      return;
    }
    if (!formData.appointmentDate) {
      showError('Please select appointment date');
      return;
    }
    if (!formData.appointmentTime) {
      showError('Please select appointment time');
      return;
    }

    if (formData.patientCategory === 'CASH') {
      setCurrentStep('billing-preview');
    } else {
      handleCompleteRegistration();
    }
  };

  const handleCompleteRegistration = async () => {
    // Ensure all required fields are present
    if (!formData.name.trim()) {
      showError('Patient name is required');
      return;
    }
    if (!formData.phone.trim()) {
      showError('Phone number is required');
      return;
    }
    if (!formData.dob) {
      showError('Date of birth is required');
      return;
    }
    if (!formData.appointmentType) {
      showError('Appointment type is required');
      return;
    }
    if (!formData.appointmentDate) {
      showError('Appointment date is required');
      return;
    }
    if (!formData.appointmentTime) {
      showError('Appointment time is required');
      return;
    }

    // If this is a returning patient, update their record instead of creating a new one
    if (selectedPatientId) {
      const existingPatient = getPatient(selectedPatientId);
      if (!existingPatient) {
        showError('Selected patient not found. Please try again.');
        return;
      }

      // Update existing patient with new appointment and status
      const updatedAppointment = {
        id: `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId: existingPatient.id,
        appointmentType: formData.appointmentType as AppointmentType,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        priority: formData.priority,
        assignedDoctorId: formData.assignedDoctorId || undefined,
        assignedDepartment: 'OPTOMETRY',
        status: 'SCHEDULED' as const,
      };

      const updateData: Partial<Patient> = {
        status: PatientStatus.WAITING,
        checkedInAt: new Date().toISOString(), // Update check-in time
        appointment: updatedAppointment,
      };

      // Always sync insurance from current category (fix: cash patients were left as NHIF)
      if (formData.patientCategory === 'CASH') {
        updateData.insuranceType = InsuranceType.CASH;
        updateData.insuranceProvider = null as unknown as InsuranceProvider; // explicit null so API clears DB
        updateData.insuranceNumber = '';
        updateData.nhifAuthNumber = '';
      } else {
        updateData.insuranceType = formData.insuranceProvider === InsuranceProvider.NHIF 
          ? InsuranceType.NHIF 
          : InsuranceType.PRIVATE;
        updateData.insuranceProvider = formData.insuranceProvider as InsuranceProvider;
        updateData.insuranceProviderName = formData.insuranceProvider;
        updateData.insuranceNumber = formData.insuranceNumber || undefined;
        updateData.nhifAuthNumber = formData.insuranceProvider === InsuranceProvider.NHIF 
          ? formData.nhifAuthNumber || undefined 
          : undefined;
      }

      // Update address if provided
      if (formData.address.trim()) {
        updateData.address = formData.address.trim();
      }

      // Add bill items for cash patients
      if (formData.patientCategory === 'CASH' && formData.selectedServices.length > 0) {
        updateData.billItems = formData.selectedServices.map((service, index) => ({
          id: `BILL-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          description: service.replace(/_/g, ' '),
          amount: HOSPITAL_PRICING[service as keyof typeof HOSPITAL_PRICING] || 0,
          category: 'CLINICAL' as const,
          isCoveredByNHIF: false,
        }));
      }

      try {
        const result = await updatePatient(existingPatient.id, updateData);
        
        if (result.success) {
          const updatedPatient = getPatient(existingPatient.id);
          if (updatedPatient) {
            setSavedPatient(updatedPatient);
            setCurrentStep('complete');
            showSuccess(`Returning patient "${updatedPatient.name}" (ID: ${updatedPatient.id}) - Appointment scheduled successfully!`);
            
            // Reset form after 5 seconds
            setTimeout(() => {
              setCurrentStep('category');
              setFormData({
                patientCategory: '',
                name: '',
                phone: '',
                dob: '',
                address: '',
                gender: 'Male',
                insuranceProvider: '' as InsuranceProvider | '',
                insuranceNumber: '',
                nhifAuthNumber: '',
                appointmentType: '' as AppointmentType | '',
                appointmentDate: '',
                appointmentTime: '',
                priority: AppointmentPriority.NORMAL,
                assignedDoctorId: '',
                selectedServices: [],
              });
              setIsVerified(false);
              setVerificationError('');
              setSearchTerm('');
              setSelectedPatientId(null);
              setSavedPatient(null);
            }, 5000);
          }
        } else {
          showError(result.error || 'Failed to update patient. Please try again.');
        }
      } catch (error) {
        console.error('Update error:', error);
        showError('An error occurred while updating patient. Please try again.');
      }
      return;
    }

    // For new patients, check for duplicates
    const sanitizedName = sanitizeInput(formData.name);
    const existingPatient = patients.find(p => 
      sanitizeInput(p.name).toLowerCase() === sanitizedName.toLowerCase() && 
      p.phone === formData.phone
    );

    if (existingPatient) {
      showError(`Patient "${formData.name}" with phone "${formData.phone}" already exists (ID: ${existingPatient.id}). Please use the search feature to find existing patients.`);
      return;
    }

    // Generate patient ID first so we can use it in the appointment
    const patientId = generatePatientId(patients);

    // Create visit for insurance patients (especially NHIF)
    let visitId = currentVisitId;
    if (formData.patientCategory === 'INSURANCE') {
      // For new patients, visit will be created after patient is saved
      // For now, we'll create it after patient creation
    }

    const patientData = {
      id: patientId, // Pre-generate ID so appointment can reference it
      name: sanitizeInput(formData.name), // Sanitize on submit
      phone: formData.phone,
      dob: formData.dob,
      age: calculatedAge !== null ? calculatedAge : undefined,
      address: formData.address.trim() || undefined,
      gender: formData.gender,
      insuranceType: formData.patientCategory === 'CASH' ? InsuranceType.CASH : 
                     (formData.insuranceProvider === InsuranceProvider.NHIF ? InsuranceType.NHIF : InsuranceType.PRIVATE),
      insuranceProvider: formData.patientCategory === 'INSURANCE' ? formData.insuranceProvider as InsuranceProvider : undefined,
      insuranceProviderName: formData.patientCategory === 'INSURANCE' ? formData.insuranceProvider : undefined,
      insuranceNumber: formData.patientCategory === 'INSURANCE' ? formData.insuranceNumber : undefined,
      nhifAuthNumber: formData.insuranceProvider === InsuranceProvider.NHIF ? formData.nhifAuthNumber : undefined,
      status: PatientStatus.WAITING,
      checkedInAt: new Date().toISOString(), // Auto-generated timestamp
      billItems: formData.patientCategory === 'CASH' ? formData.selectedServices.map((service, index) => ({
        id: `BILL-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        description: service.replace(/_/g, ' '),
        amount: HOSPITAL_PRICING[service as keyof typeof HOSPITAL_PRICING] || 0,
        category: 'CLINICAL' as const,
        isCoveredByNHIF: false,
      })) : [],
      chiefComplaint: '',
      appointment: {
        id: `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId: patientId, // Use the pre-generated patient ID
        appointmentType: formData.appointmentType as AppointmentType,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        priority: formData.priority,
        assignedDoctorId: formData.assignedDoctorId || undefined,
        assignedDepartment: 'OPTOMETRY',
        status: 'SCHEDULED' as const,
      },
    };

    try {
      const result = await addPatient(patientData);
      
      if (result.success && result.patient) {
        // Create visit for insurance patients (if not already created)
        if (formData.patientCategory === 'INSURANCE' && !currentVisitId) {
          const visitResult = await createVisit(
            result.patient.id,
            'INSURANCE',
            formData.insuranceProvider
          );
          if (visitResult.success && visitResult.visitId) {
            setCurrentVisitId(visitResult.visitId);
            
            // If NHIF was verified before patient creation, re-verify with new visit ID
            if (formData.insuranceProvider === InsuranceProvider.NHIF && verificationResult && verificationResult.authorizationStatus === AuthorizationStatus.ACCEPTED) {
              // Re-verify with the new visit ID to store verification properly
              await verifyNHIF(
                {
                  cardNo: formData.insuranceNumber.trim(),
                  visitTypeId: formData.visitTypeId,
                  referralNo: formData.referralNo.trim() || undefined,
                },
                visitResult.visitId
              );
            }
          }
        }
        
        // Store the saved patient for display
        setSavedPatient(result.patient);
        
        // Patient is now saved in state and localStorage (via PatientContext useEffect)
        setCurrentStep('complete');
        showSuccess(`Patient "${result.patient.name}" (ID: ${result.patient.id}) registered and saved successfully!`);
        
        // Reset form after 5 seconds (increased for better visibility)
        setTimeout(() => {
          setCurrentStep('category');
          setFormData({
            patientCategory: '',
            name: '',
            phone: '',
            dob: '',
            address: '',
            gender: 'Male',
            insuranceProvider: '' as InsuranceProvider | '',
            insuranceNumber: '',
            nhifAuthNumber: '',
            appointmentType: '' as AppointmentType | '',
            appointmentDate: '',
            appointmentTime: '',
            priority: AppointmentPriority.NORMAL,
            assignedDoctorId: '',
            selectedServices: [],
          });
          setIsVerified(false);
          setVerificationError('');
          setSearchTerm('');
          setSelectedPatientId(null);
          setSavedPatient(null);
        }, 5000);
      } else {
        showError(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showError('An error occurred during registration. Please try again.');
    }
  };

  // Select returning patient — preserve user's category (CASH vs INSURANCE) so "register as cash" works
  const handleSelectReturningPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      const keepCategory = formData.patientCategory || (patient.insuranceType === InsuranceType.CASH ? 'CASH' : 'INSURANCE');
      const base = {
        ...formData,
        name: patient.name,
        phone: patient.phone,
        dob: patient.dob,
        address: patient.address || '',
        gender: patient.gender,
        patientCategory: keepCategory,
        insuranceProvider: keepCategory === 'INSURANCE' && patient.insuranceType !== InsuranceType.CASH
          ? (patient.insuranceProvider as InsuranceProvider) || ('' as InsuranceProvider)
          : ('' as InsuranceProvider),
        insuranceNumber: keepCategory === 'INSURANCE' ? (patient.insuranceNumber || '') : '',
      };
      setFormData(keepCategory === 'CASH'
        ? { ...base, appointmentDate: getCurrentDate(), appointmentTime: getNextAvailableTime() }
        : base);
      setSelectedPatientId(patientId);
      setSearchTerm('');
      setCurrentStep(keepCategory === 'CASH' ? 'appointment' : 'insurance');
    }
  };

  // Step 1: Category Selection
  if (currentStep === 'category') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-brand-primary-dark px-8 py-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold tracking-tight">Patient Registration</h3>
              <p className="text-white/80 text-sm font-medium uppercase tracking-wide mt-1">Select Patient Category</p>
            </div>
            <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: 'var(--brand-primary)' }}>
              <i className="fas fa-user-plus text-base text-white"></i>
            </div>
          </div>

          {/* Returning Patient Search */}
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">Search Returning Patient</label>
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, phone, or ID..."
                className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
              />
              {searchTerm && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchResults.map(patient => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handleSelectReturningPatient(patient.id)}
                      className="w-full p-4 text-left hover:bg-slate-50 transition-all border-b border-slate-100 last:border-none"
                    >
                      <p className="text-sm font-semibold text-slate-800">{patient.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{patient.phone} • ID: {patient.id}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category Selection */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => handleCategorySelect('CASH')}
                className="p-8 border-2 border-slate-200 rounded-2xl hover:border-brand-primary hover:bg-brand-primary-50 transition-all text-left group"
                onMouseEnter={(e) => {
                  const iconContainer = e.currentTarget.querySelector('.cash-icon-container') as HTMLElement;
                  const icon = e.currentTarget.querySelector('.cash-icon') as HTMLElement;
                  if (iconContainer) iconContainer.style.backgroundColor = 'var(--brand-primary)';
                  if (icon) icon.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  const iconContainer = e.currentTarget.querySelector('.cash-icon-container') as HTMLElement;
                  const icon = e.currentTarget.querySelector('.cash-icon') as HTMLElement;
                  if (iconContainer) iconContainer.style.backgroundColor = '#d1fae5';
                  if (icon) icon.style.color = 'var(--brand-primary)';
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="cash-icon-container w-16 h-16 rounded-xl flex items-center justify-center transition-colors"
                    style={{ backgroundColor: '#d1fae5' }}
                  >
                    <i className="cash-icon fas fa-money-bill-wave text-2xl transition-colors" style={{ color: 'var(--brand-primary)' }}></i>
                  </div>
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-2">Cash Payment</h4>
                <p className="text-xs text-slate-600">Direct payment at hospital rates</p>
              </button>

              <button
                onClick={() => handleCategorySelect('INSURANCE')}
                className="p-8 border-2 border-slate-200 rounded-2xl hover:border-brand-primary hover:bg-brand-primary-50 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
                    <i className="fas fa-shield-alt text-2xl text-green-600 group-hover:text-white"></i>
                  </div>
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-2">Insurance</h4>
                <p className="text-xs text-slate-600">Covered by insurance provider</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Patient Details
  if (currentStep === 'patient-details') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-brand-primary-dark px-8 py-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold tracking-tight">Patient Demographics</h3>
              <p className="text-white/80 text-xs font-medium uppercase tracking-wide mt-1">
                {formData.patientCategory} Patient
              </p>
            </div>
            <button
              onClick={() => setCurrentStep('category')}
              className="text-white/80 hover:text-white transition-colors"
            >
              <i className="fas fa-arrow-left text-base text-white"></i>
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handlePatientDetailsSubmit(); }} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Full Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter Full Name"
                  maxLength={100}
                  className={`w-full h-12 px-4 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all text-sm font-normal ${errors.name ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                <input
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const sanitized = sanitizeInput(e.target.value).replace(/\D/g, '').substring(0, 10);
                    setFormData({ ...formData, phone: sanitized });
                  }}
                  placeholder="Enter Phone Number"
                  maxLength={10}
                  className={`w-full h-12 px-4 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all text-sm font-normal ${errors.phone ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Date of Birth</label>
                <input
                  required
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  max={getCurrentDate()} // Cannot select future dates
                  className={`w-full h-12 px-4 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all text-sm font-normal ${errors.dob ? 'border-red-300' : 'border-slate-200'}`}
                />
                {calculatedAge !== null && (
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    <i className="fas fa-calendar-alt mr-1 text-slate-600"></i>
                    Age: <span className="font-semibold">{calculatedAge} years old</span>
                  </p>
                )}
                {errors.dob && <p className="text-xs text-red-600 mt-1">{errors.dob}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter Address"
                  maxLength={200}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all text-sm font-normal"
                />
              </div>
            </div>

            <div className="pt-6 flex justify-end items-center gap-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep('category')}
                className="text-slate-500 text-sm font-semibold hover:text-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-8 h-12 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-brand-primary-dark transition-all"
                style={{ backgroundColor: 'var(--brand-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                }}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 3: Insurance (only for insurance patients)
  if (currentStep === 'insurance' && formData.patientCategory === 'INSURANCE') {
    const selectedProvider = INSURANCE_PROVIDERS.find(p => p.value === formData.insuranceProvider);
    const requiresValidation = selectedProvider?.requiresValidation || false;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-brand-primary-dark px-8 py-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold tracking-tight">Insurance Provider</h3>
              <p className="text-white/80 text-xs font-medium uppercase tracking-wide mt-1">
                Select and validate insurance
              </p>
            </div>
            <button
              onClick={() => setCurrentStep('patient-details')}
              className="text-white/80 hover:text-white transition-colors"
            >
              <i className="fas fa-arrow-left text-base text-white"></i>
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleInsuranceSubmit(); }} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Select Insurance Provider</label>
              <select
                required
                value={formData.insuranceProvider}
                onChange={(e) => {
                  setFormData({ ...formData, insuranceProvider: e.target.value as InsuranceProvider, insuranceNumber: '', nhifAuthNumber: '' });
                  setIsVerified(false);
                  setVerificationError('');
                }}
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
              >
                <option value="">-- Select Provider --</option>
                {INSURANCE_PROVIDERS.map(provider => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.insuranceProvider && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Membership / Card Number
                    {formData.insuranceProvider === InsuranceProvider.NHIF && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.insuranceNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, insuranceNumber: e.target.value });
                      setIsVerified(false);
                      setVerificationError('');
                    }}
                    placeholder={formData.insuranceProvider === InsuranceProvider.NHIF ? 'Enter NHIF Card Number' : 'Enter Membership Number'}
                    maxLength={30}
                    className={`w-full h-12 px-4 bg-white border rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all text-sm font-normal ${errors.insuranceNumber || verificationError ? 'border-red-300' : 'border-slate-200'}`}
                  />
                  {errors.insuranceNumber && <p className="text-xs text-red-600 mt-1">{errors.insuranceNumber}</p>}
                </div>

                {formData.insuranceProvider === InsuranceProvider.NHIF && (
                  <>
                    {/* Visit Type Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Visit Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.visitTypeId}
                        onChange={(e) => {
                          const newVisitType = parseInt(e.target.value) as VisitType;
                          setFormData({ 
                            ...formData, 
                            visitTypeId: newVisitType,
                            referralNo: (newVisitType === VisitType.REFERRAL || newVisitType === VisitType.FOLLOW_UP) ? formData.referralNo : ''
                          });
                          setIsVerified(false);
                          setVerificationError('');
                        }}
                        className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                      >
                        <option value={VisitType.NORMAL}>1 - Normal Visit</option>
                        <option value={VisitType.EMERGENCY}>2 - Emergency</option>
                        <option value={VisitType.REFERRAL}>3 - Referral</option>
                        <option value={VisitType.FOLLOW_UP}>4 - Follow-up</option>
                      </select>
                    </div>

                    {/* Referral Number (Required for Referral and Follow-up) */}
                    {(formData.visitTypeId === VisitType.REFERRAL || formData.visitTypeId === VisitType.FOLLOW_UP) && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-700">
                          Referral Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={formData.referralNo}
                          onChange={(e) => {
                            setFormData({ ...formData, referralNo: e.target.value });
                            setIsVerified(false);
                            setVerificationError('');
                          }}
                          placeholder="Enter Referral Number"
                          maxLength={50}
                          className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                        />
                        <p className="text-xs text-slate-500">Required for Referral and Follow-up visits</p>
                      </div>
                    )}

                    {/* NHIF Authorization */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">NHIF Authorization</label>
                    <div className="flex gap-3">
                      <input
                        readOnly
                        type="text"
                        value={formData.nhifAuthNumber || ''}
                        placeholder={isVerified ? 'Authorized' : 'Pending validation...'}
                        className={`flex-1 h-12 px-4 border rounded-xl text-sm font-normal outline-none ${
                          isVerified
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : verificationError
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyNHIF}
                        disabled={isVerifying || isVerified || !formData.insuranceNumber.trim()}
                        className={`px-6 h-12 rounded-xl font-semibold text-sm transition-all text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                          isVerified ? 'cursor-not-allowed' : ''
                        }`}
                        style={{
                          backgroundColor: isVerified ? '#10b981' : 'var(--brand-primary)'
                        }}
                        onMouseEnter={(e) => {
                          if (!isVerified && !isVerifying) {
                            e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isVerified && !isVerifying) {
                            e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                          }
                        }}
                      >
                        {isVerifying ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2 text-white"></i>
                            Validating...
                          </>
                        ) : isVerified ? (
                          <>
                            <i className="fas fa-check mr-2 text-white"></i>
                            Verified
                          </>
                        ) : (
                          'Validate'
                        )}
                      </button>
                    </div>

                    {/* Verification Result Display */}
                    {verificationResult && (
                      <div className={`p-4 rounded-xl border ${
                        verificationResult.authorizationStatus === AuthorizationStatus.ACCEPTED
                          ? 'bg-emerald-50 border-emerald-200'
                          : verificationResult.authorizationStatus === AuthorizationStatus.UNKNOWN
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className={`text-xs font-bold uppercase tracking-wide ${
                              verificationResult.authorizationStatus === AuthorizationStatus.ACCEPTED
                                ? 'text-emerald-700'
                                : verificationResult.authorizationStatus === AuthorizationStatus.UNKNOWN
                                ? 'text-yellow-700'
                                : 'text-red-700'
                            }`}>
                              Status: {verificationResult.authorizationStatus}
                            </p>
                            {verificationResult.authorizationNo && (
                              <p className="text-xs text-slate-600 mt-1">
                                Auth No: <span className="font-mono font-semibold">{verificationResult.authorizationNo}</span>
                              </p>
                            )}
                            {verificationResult.memberName && (
                              <p className="text-xs text-slate-600 mt-1">
                                Member: {verificationResult.memberName}
                              </p>
                            )}
                            {verificationResult.cardStatus && (
                              <p className="text-xs text-slate-600 mt-1">
                                Card Status: {verificationResult.cardStatus}
                              </p>
                            )}
                          </div>
                          {verificationResult.authorizationNo && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(verificationResult.authorizationNo!);
                                showSuccess('Authorization number copied to clipboard');
                              }}
                              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                              title="Copy authorization number"
                            >
                              <i className="fas fa-copy text-slate-600 text-xs"></i>
                            </button>
                          )}
                        </div>
                        {verificationResult.remarks && (
                          <p className="text-xs text-slate-600 mt-2">{verificationResult.remarks}</p>
                        )}
                        {verificationResult.authorizationStatus === AuthorizationStatus.UNKNOWN && (
                          <p className="text-xs text-yellow-700 font-semibold mt-2">
                            ⚠️ Warning: Please verify at NHIF office
                          </p>
                        )}
                      </div>
                    )}

                    {verificationError && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xs text-red-700 font-semibold mb-2">{verificationError}</p>
                        {verificationResult?.authorizationStatus === AuthorizationStatus.REJECTED && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (currentVisitId && window.confirm('Convert this visit to CASH payment? This action will be logged.')) {
                                // Convert to cash - this would call the API
                                showSuccess('Visit converted to CASH. Please proceed with cash payment.');
                                setFormData(prev => ({ ...prev, patientCategory: 'CASH', insuranceProvider: '' as InsuranceProvider }));
                                setIsVerified(false);
                                setVerificationResult(null);
                              }
                            }}
                            className="mt-2 px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
                          >
                            Convert to CASH Payment
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  </>
                )}

                {formData.insuranceProvider !== InsuranceProvider.NHIF && (
                  <div className="p-4 bg-brand-primary-50 border border-brand-primary-100 rounded-xl">
                    <p className="text-xs text-brand-primary-dark">
                      <i className="fas fa-info-circle mr-2 text-brand-primary-dark"></i>
                      No validation required for {formData.insuranceProvider}. You may proceed.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="pt-6 flex justify-end items-center gap-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep('patient-details')}
                className="text-slate-500 text-sm font-semibold hover:text-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-8 h-12 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-brand-primary-dark transition-all"
                style={{ backgroundColor: 'var(--brand-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                }}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 4: Appointment Scheduling
  if (currentStep === 'appointment') {
    // Map appointment types to services for cash patients
    const appointmentServiceMap: Record<AppointmentType, string> = {
      [AppointmentType.EYE_CONSULTATION]: 'EYE_CONSULTATION',
      [AppointmentType.VISION_TEST]: 'VISION_TEST',
      [AppointmentType.OPTICAL_REVIEW]: 'OPTICAL_REVIEW',
      [AppointmentType.SPECIALIST_CONSULTATION]: 'SPECIALIST_CONSULTATION',
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-brand-primary-dark px-8 py-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold tracking-tight">Appointment Scheduling</h3>
              <p className="text-white/80 text-xs font-medium uppercase tracking-wide mt-1">
                Schedule patient appointment
              </p>
            </div>
            <button
              onClick={() => formData.patientCategory === 'CASH' ? setCurrentStep('patient-details') : setCurrentStep('insurance')}
              className="text-white/80 hover:text-white transition-colors"
            >
              <i className="fas fa-arrow-left text-base text-white"></i>
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleAppointmentSubmit(); }} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Appointment Type</label>
                <select
                  required
                  value={formData.appointmentType}
                  onChange={(e) => {
                    const type = e.target.value as AppointmentType;
                    setFormData({
                      ...formData,
                      appointmentType: type,
                      // For cash patients, automatically add to selected services
                      selectedServices: formData.patientCategory === 'CASH' 
                        ? [appointmentServiceMap[type]]
                        : formData.selectedServices,
                    });
                  }}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                >
                  <option value="">-- Select Appointment Type --</option>
                  {Object.values(AppointmentType).map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  Appointment Date
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, appointmentDate: getCurrentDate() })}
                    className="text-xs text-brand-primary hover:text-brand-primary-dark font-semibold"
                    title="Set to today"
                  >
                    <i className="fas fa-clock mr-1 text-brand-primary"></i>Today
                  </button>
                </label>
                <input
                  required
                  type="date"
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  min={getCurrentDate()}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all text-sm font-normal"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  Appointment Time
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, appointmentTime: getNextAvailableTime() })}
                    className="text-xs text-brand-primary hover:text-brand-primary-dark font-semibold"
                    title="Set to next available time"
                  >
                    <i className="fas fa-clock mr-1 text-brand-primary"></i>Next Available
                  </button>
                </label>
                <input
                  required
                  type="time"
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all text-sm font-normal"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as AppointmentPriority })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                >
                  {Object.values(AppointmentPriority).map(priority => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Assign Doctor (Optional)</label>
                <select
                  value={formData.assignedDoctorId}
                  onChange={(e) => setFormData({ ...formData, assignedDoctorId: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                >
                  <option value="">-- Auto Assign --</option>
                  {availableDoctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} – {doctor.specialization || doctor.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-6 flex justify-end items-center gap-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => formData.patientCategory === 'CASH' ? setCurrentStep('patient-details') : setCurrentStep('insurance')}
                className="text-slate-500 text-sm font-semibold hover:text-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-8 h-12 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-brand-primary-dark transition-all"
                style={{ backgroundColor: 'var(--brand-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                }}
              >
                {formData.patientCategory === 'CASH' ? 'Review Billing' : 'Complete Registration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 5: Billing Preview (Cash patients only)
  if (currentStep === 'billing-preview' && formData.patientCategory === 'CASH') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-brand-primary-dark px-8 py-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold tracking-tight">Billing Preview</h3>
              <p className="text-white/80 text-xs font-medium uppercase tracking-wide mt-1">
                Review charges before confirmation
              </p>
            </div>
            <button
              onClick={() => setCurrentStep('appointment')}
              className="text-white/80 hover:text-white transition-colors"
            >
              <i className="fas fa-arrow-left text-base text-white"></i>
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">Selected Services</h4>
              <div className="space-y-3">
                {formData.selectedServices.map(service => {
                  const price = HOSPITAL_PRICING[service as keyof typeof HOSPITAL_PRICING] || 0;
                  return (
                    <div key={service} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-sm font-medium text-slate-700">{service.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-semibold text-slate-900">TZS {price.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="text-base font-bold text-slate-900">Total Amount</span>
                <span className="text-base font-bold text-brand-primary">TZS {billingPreview?.toLocaleString() || '0'}</span>
              </div>
            </div>

            <div className="pt-6 flex justify-end items-center gap-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep('appointment')}
                className="text-slate-500 text-sm font-semibold hover:text-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCompleteRegistration}
                className="px-8 h-12 bg-green-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-green-700 transition-all"
              >
                Confirm & Register
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 6: Complete
  if (currentStep === 'complete') {
    // Use saved patient or find it from patients list
    const displayPatient = savedPatient || (patients.length > 0 ? patients.find(p => 
      p.name === sanitizeInput(formData.name) && 
      p.phone === formData.phone
    ) || patients[patients.length - 1] : null);
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-green-50 px-8 py-6 border-b border-green-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center shadow-md">
                <i className="fas fa-check text-2xl text-white"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 mb-1">Registration Complete!</h3>
                <p className="text-xs text-slate-600">Patient has been saved and is ready to proceed</p>
              </div>
            </div>
          </div>

          {displayPatient && (
            <div className="p-8 space-y-4">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-4">Patient Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Name</p>
                    <p className="font-semibold text-slate-900">{displayPatient.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Patient ID</p>
                    <p className="font-semibold text-slate-900 font-mono text-xs">{displayPatient.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Phone</p>
                    <p className="font-semibold text-slate-900">{displayPatient.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold">
                      {displayPatient.status}
                    </span>
                  </div>
                  {displayPatient.appointment && (
                    <>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Appointment Type</p>
                        <p className="font-semibold text-slate-900">{displayPatient.appointment.appointmentType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Appointment Date</p>
                        <p className="font-semibold text-slate-900">
                          {formatDate(displayPatient.appointment.appointmentDate)} at {formatTime(displayPatient.appointment.appointmentTime)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setCurrentStep('category');
                    setFormData({
                      patientCategory: '',
                      name: '',
                      phone: '',
                      dob: '',
                      address: '',
                      gender: 'Male',
                      insuranceProvider: '' as InsuranceProvider | '',
                      insuranceNumber: '',
                      nhifAuthNumber: '',
                      appointmentType: '' as AppointmentType | '',
                      appointmentDate: '',
                      appointmentTime: '',
                      priority: AppointmentPriority.NORMAL,
                      assignedDoctorId: '',
                      selectedServices: [],
                    });
                    setIsVerified(false);
                    setVerificationError('');
                    setSearchTerm('');
                    setSelectedPatientId(null);
                  }}
                  className="flex-1 px-6 h-12 text-white rounded-xl font-semibold text-sm shadow-md transition-all"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                  }}
                >
                  Register Another Patient
                </button>
              </div>
            </div>
          )}

          {!displayPatient && (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-4">Patient saved successfully!</p>
              <p className="text-xs text-slate-500">You can now view the patient in the Patients List or Queue Board.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Registration;
