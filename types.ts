
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  RECEPTIONIST = 'RECEPTIONIST',
  OPTOMETRIST = 'OPTOMETRIST',
  OPTICAL_DISPENSER = 'OPTICAL_DISPENSER',
  PHARMACIST = 'PHARMACIST',
  BILLING_OFFICER = 'BILLING_OFFICER',
  CLAIM_OFFICER = 'CLAIM_OFFICER'
}

export enum PatientStatus {
  ARRIVED = 'ARRIVED',
  WAITING = 'WAITING',
  IN_CLINICAL = 'IN_CLINICAL',
  PENDING_TREATMENT = 'PENDING_TREATMENT',
  IN_PHARMACY = 'IN_PHARMACY',
  IN_OPTICAL = 'IN_OPTICAL',
  PENDING_BILLING = 'PENDING_BILLING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum InsuranceType {
  NHIF = 'NHIF',
  PRIVATE = 'PRIVATE',
  CASH = 'CASH'
}

export enum InsuranceProvider {
  NHIF = 'NHIF',
  BRITAM = 'Britam',
  JUBILEE = 'Jubilee',
  STRATEGIS = 'Strategis',
  SANLAM = 'Sanlam',
  AAR = 'AAR'
}

export enum AppointmentType {
  EYE_CONSULTATION = 'Eye Consultation',
  VISION_TEST = 'Vision Test',
  OPTICAL_REVIEW = 'Optical Review',
  SPECIALIST_CONSULTATION = 'Specialist Consultation'
}

export enum AppointmentPriority {
  NORMAL = 'Normal',
  EMERGENCY = 'Emergency'
}

export enum VisitType {
  NORMAL = 1,
  EMERGENCY = 2,
  REFERRAL = 3,
  FOLLOW_UP = 4
}

export enum AuthorizationStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
  UNKNOWN = 'UNKNOWN',
  INVALID = 'INVALID'
}

export interface Visit {
  id: string;
  patientId: string;
  visitDate: string;
  visitTime: string;
  department: string;
  payerType: 'CASH' | 'INSURANCE';
  insuranceProvider?: string;
  status: 'REGISTERED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface NHIFVerification {
  id: string;
  visitId: string;
  cardNo: string;
  visitTypeId: VisitType;
  referralNo?: string;
  remarksSent?: string;
  cardStatus?: string;
  authorizationStatus: AuthorizationStatus;
  authorizationNo?: string;
  memberName?: string;
  responsePayload?: any;
  verifiedBy: string;
  verifiedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  appointmentType: AppointmentType;
  appointmentDate: string;
  appointmentTime: string;
  priority: AppointmentPriority;
  assignedDoctorId?: string;
  assignedDepartment?: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

export interface PrescriptionHistoryEvent {
  date: string;
  od: string;
  os: string;
  addOd?: string;
  addOs?: string;
  dispensedItems: string[];
  providerName: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  form: 'Tablet' | 'Capsule' | 'Drops' | 'Ointment' | 'Syrup';
  price: number;
  stock: number;
  isCoveredByNHIF: boolean;
  isCoveredByPrivate?: boolean;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  dob: string;
  age?: number; // Calculated from date of birth
  address?: string;
  gender: string;
  insuranceType: InsuranceType;
  insuranceProvider?: InsuranceProvider; // Specific insurance provider
  insuranceProviderName?: string; // Legacy field, kept for compatibility
  insuranceNumber?: string;
  nhifAuthNumber?: string;
  status: PatientStatus;
  assignedProviderId?: string;
  checkedInAt: string;
  chiefComplaint?: string;
  clinicalNotes?: string;
  consultationNotes?: string;
  ophthalmologistNotes?: string;
  diagnosis?: string;
  appointment?: Appointment; // Current appointment
  visitId?: string; // Current visit ID (for NHIF verification)
  prescription?: {
    od: string;
    os: string;
    add?: string;
    addOd?: string;
    addOs?: string;
    edgeColor?: string;
    medications?: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>;
  };
  billItems: BillItem[];
  prescriptionHistory?: PrescriptionHistoryEvent[];
}

export interface BillItem {
  id: string;
  description: string;
  amount: number;
  category: 'CLINICAL' | 'PHARMACY' | 'OPTICAL';
  isCoveredByNHIF: boolean;
  isCoveredByPrivate?: boolean; // New field for private insurance eligibility
}

export interface Provider {
  id: string;
  name: string;
  role: UserRole;
  isNHIFVerified: boolean;
  specialization?: string;
  status: 'AVAILABLE' | 'BUSY' | 'ON_BREAK' | 'OFFLINE';
  queue: string[]; // Patient IDs
}
