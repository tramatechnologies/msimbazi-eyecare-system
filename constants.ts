
import { UserRole, Provider, Patient, PatientStatus, InsuranceType } from './types';

export const MOCK_PROVIDERS: Provider[] = [
  { id: 'opt-1', name: 'Dr. Namangi Fadhili Msangi', role: UserRole.OPTOMETRIST, isNHIFVerified: true, status: 'AVAILABLE', queue: [], specialization: 'General Optometry' },
  { id: 'opt-2', name: 'Dr. Sarah Kamau', role: UserRole.OPTOMETRIST, isNHIFVerified: true, status: 'BUSY', queue: [], specialization: 'Glaucoma' },
  { id: 'opt-3', name: 'Dr. John Mwangi', role: UserRole.OPTOMETRIST, isNHIFVerified: true, status: 'ON_BREAK', queue: [], specialization: 'Pediatrics' },
  { id: 'opt-4', name: 'Dr. Grace Nduta', role: UserRole.OPTOMETRIST, isNHIFVerified: true, status: 'AVAILABLE', queue: [], specialization: 'Refraction' },
  { id: 'opt-5', name: 'Dr. Peter Omondi', role: UserRole.OPTOMETRIST, isNHIFVerified: false, status: 'AVAILABLE', queue: [], specialization: 'Refraction' },
];

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'P001',
    name: 'John Doe',
    phone: '0712345678',
    dob: '1985-05-12',
    gender: 'Male',
    insuranceType: InsuranceType.NHIF,
    insuranceNumber: 'NH-987654321',
    status: PatientStatus.WAITING,
    assignedProviderId: 'opt-1',
    checkedInAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    chiefComplaint: 'Blurry distance vision for 3 months.',
    billItems: [],
    prescriptionHistory: [
      {
        date: '2023-05-15',
        od: '-1.50 DS',
        os: '-1.75 DS',
        addOd: '+1.50',
        addOs: '+1.50',
        dispensedItems: ['Titanium Frame', 'Progressive Blue Cut Lenses'],
        providerName: 'Dr. Sarah Kamau'
      },
      {
        date: '2022-01-10',
        od: '-1.25 DS',
        os: '-1.25 DS',
        addOd: '+1.25',
        addOs: '+1.25',
        dispensedItems: ['Plastic Classic Frame', 'Bifocal Lenses'],
        providerName: 'Dr. John Mwangi'
      }
    ]
  },
  {
    id: 'P002',
    name: 'Jane Smith',
    phone: '0722334455',
    dob: '1992-11-20',
    gender: 'Female',
    insuranceType: InsuranceType.CASH,
    status: PatientStatus.IN_CLINICAL,
    assignedProviderId: 'opt-2',
    checkedInAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    chiefComplaint: 'Regular checkup.',
    billItems: [],
    prescriptionHistory: []
  }
];

// Brand colors - Update these with colors extracted from the logo
// Use the extract-colors.html file to identify colors from the logo
export const APP_THEME = {
  primary: 'var(--brand-primary)', // Main brand color from logo
  primaryDark: 'var(--brand-primary-dark)',
  primaryLight: 'var(--brand-primary-light)',
  secondary: 'var(--brand-secondary)', // Secondary brand color from logo
  secondaryDark: 'var(--brand-secondary-dark)',
  secondaryLight: 'var(--brand-secondary-light)',
  accent: 'var(--brand-secondary)', // Use secondary as accent
  success: 'var(--brand-success)',
  danger: 'var(--brand-danger)',
  warning: 'var(--brand-warning)',
  info: 'var(--brand-info)',
};

/**
 * Clinical fees and pricing constants - Hospital Price List
 */
export const HOSPITAL_PRICING = {
  // Consultation Fees
  EYE_CONSULTATION: 25000,
  VISION_TEST: 15000,
  OPTICAL_REVIEW: 20000,
  SPECIALIST_CONSULTATION: 50000,
  COMPREHENSIVE_EXAMINATION: 30000,
  BASIC_EXAMINATION: 15000,
  
  // Tests
  VISUAL_ACUITY_TEST: 10000,
  REFRACTION_TEST: 15000,
  INTRAOCULAR_PRESSURE_TEST: 12000,
  FUNDOSCOPY: 18000,
  SLIT_LAMP_EXAMINATION: 15000,
  
  // Procedures
  MINOR_PROCEDURE: 30000,
  MAJOR_PROCEDURE: 100000,
} as const;

/**
 * Legacy clinical fees (for backward compatibility)
 */
export const CLINICAL_FEES = {
  COMPREHENSIVE_EXAMINATION: HOSPITAL_PRICING.COMPREHENSIVE_EXAMINATION,
  BASIC_EXAMINATION: HOSPITAL_PRICING.BASIC_EXAMINATION,
  SPECIALIST_CONSULTATION: HOSPITAL_PRICING.SPECIALIST_CONSULTATION,
} as const;

/**
 * Insurance Providers List - Tanzania
 */
export const INSURANCE_PROVIDERS = [
  { value: 'NHIF', label: 'NHIF', requiresValidation: true },
  { value: 'Britam', label: 'Britam', requiresValidation: false },
  { value: 'Jubilee', label: 'Jubilee', requiresValidation: false },
  { value: 'Strategis', label: 'Strategis', requiresValidation: false },
  { value: 'Sanlam', label: 'Sanlam', requiresValidation: false },
  { value: 'AAR', label: 'AAR', requiresValidation: false },
] as const;

/**
 * Insurance coverage constants
 */
export const INSURANCE_COVERAGE = {
  PRIVATE_DEFAULT_PERCENTAGE: 0.9, // 90% coverage for private insurance
  NHIF_COVERAGE_PERCENTAGE: 1.0, // 100% coverage for NHIF (if eligible)
} as const;

/**
 * UI/UX timing constants (in milliseconds)
 */
export const UI_TIMING = {
  DEBOUNCE_DELAY: 300, // Search debounce delay
  TOAST_DURATION: 3000, // Default toast notification duration
  TOAST_FADE_OUT: 300, // Toast fade-out animation duration
  AI_REQUEST_TIMEOUT: 30000, // AI service request timeout (30 seconds)
} as const;

/**
 * Input validation limits
 */
export const VALIDATION_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MIN_NAME_LENGTH: 2,
  MAX_NOTES_LENGTH: 5000,
  MAX_PRESCRIPTION_LENGTH: 50,
  PHONE_LENGTH: 10,
} as const;
