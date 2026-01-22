/**
 * Performance Utilities
 * Functions for calculating role-specific performance metrics
 */

import { Patient, PatientStatus, UserRole } from '../types';
import { calculateBillTotal } from './patientUtils';
import { formatDate } from './dateTimeUtils';

export interface UserPerformance {
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  period: string;
  dateRange: { start: string; end: string };
  metrics: {
    // Receptionist metrics
    patientsRegistered?: number;
    appointmentsScheduled?: number;
    
    // Optometrist metrics
    patientsSeen?: number;
    prescriptionsCreated?: number;
    averageConsultationTime?: number;
    
    // Pharmacist metrics
    medicationsDispensed?: number;
    prescriptionsFilled?: number;
    totalPharmacyRevenue?: number;
    
    // Optical Dispenser metrics
    framesDispensed?: number;
    lensesDispensed?: number;
    opticalRevenue?: number;
    
    // Billing Officer metrics
    paymentsProcessed?: number;
    totalRevenueCollected?: number;
    averageTransactionAmount?: number;
    insuranceClaimsProcessed?: number;
    
    // Manager metrics
    totalPatientsOversaw?: number;
    departmentsMonitored?: number;
    reportsGenerated?: number;
    
    // Admin metrics
    systemUsersManaged?: number;
    systemHealthScore?: number;
    auditLogsReviewed?: number;
  };
  details?: {
    patients?: Patient[];
    revenue?: number;
    activities?: Array<{ date: string; action: string; count: number }>;
  };
}

/**
 * Calculate performance for Receptionist role
 */
export const calculateReceptionistPerformance = (
  userId: string,
  userName: string,
  userEmail: string,
  patients: Patient[],
  dateRange: { start: Date; end: Date }
): UserPerformance => {
  const filteredPatients = patients.filter(p => {
    const checkInDate = new Date(p.checkedInAt);
    return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
  });

  // Count patients registered (assuming created by this receptionist)
  // In a real system, you'd track who created each patient
  const patientsRegistered = filteredPatients.length;
  
  // Count appointments scheduled (if appointments are tracked)
  const appointmentsScheduled = filteredPatients.filter(p => 
    p.status === PatientStatus.WAITING || p.status === PatientStatus.ARRIVED
  ).length;

  const startDate = dateRange.start instanceof Date ? dateRange.start : new Date();
  const endDate = dateRange.end instanceof Date ? dateRange.end : new Date();

  return {
    userId,
    userName,
    userEmail,
    role: UserRole.RECEPTIONIST,
    period: 'custom',
    dateRange: {
      start: formatDate(startDate.toISOString()),
      end: formatDate(endDate.toISOString()),
    },
    metrics: {
      patientsRegistered,
      appointmentsScheduled,
    },
    details: {
      patients: filteredPatients,
    },
  };
};

/**
 * Calculate performance for Optometrist role
 */
export const calculateOptometristPerformance = (
  userId: string,
  userName: string,
  userEmail: string,
  patients: Patient[],
  dateRange: { start: Date; end: Date }
): UserPerformance => {
  const filteredPatients = patients.filter(p => {
    const checkInDate = new Date(p.checkedInAt);
    return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
  });

  // Patients seen in clinical
  const patientsSeen = filteredPatients.filter(p => 
    p.status === PatientStatus.IN_CLINICAL || 
    p.status === PatientStatus.PENDING_TREATMENT ||
    p.status === PatientStatus.COMPLETED
  ).length;

  // Prescriptions created
  const prescriptionsCreated = filteredPatients.reduce((count, p) => {
    return count + (p.prescriptions?.length || 0);
  }, 0);

  const startDate = dateRange.start instanceof Date ? dateRange.start : new Date();
  const endDate = dateRange.end instanceof Date ? dateRange.end : new Date();

  return {
    userId,
    userName,
    userEmail,
    role: UserRole.OPTOMETRIST,
    period: 'custom',
    dateRange: {
      start: formatDate(startDate.toISOString()),
      end: formatDate(endDate.toISOString()),
    },
    metrics: {
      patientsSeen,
      prescriptionsCreated,
      averageConsultationTime: patientsSeen > 0 ? 30 : 0, // Placeholder
    },
    details: {
      patients: filteredPatients.filter(p => 
        p.status === PatientStatus.IN_CLINICAL || 
        p.status === PatientStatus.PENDING_TREATMENT ||
        p.status === PatientStatus.COMPLETED
      ),
    },
  };
};

/**
 * Calculate performance for Pharmacist role
 */
export const calculatePharmacistPerformance = (
  userId: string,
  userName: string,
  userEmail: string,
  patients: Patient[],
  dateRange: { start: Date; end: Date }
): UserPerformance => {
  const filteredPatients = patients.filter(p => {
    const checkInDate = new Date(p.checkedInAt);
    return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
  });

  // Patients with pharmacy items
  const pharmacyPatients = filteredPatients.filter(p => 
    p.status === PatientStatus.IN_PHARMACY ||
    p.status === PatientStatus.PENDING_BILLING ||
    (p.billItems?.some(item => item.category === 'PHARMACY') || false)
  );

  const medicationsDispensed = pharmacyPatients.reduce((count, p) => {
    return count + (p.billItems?.filter(item => item.category === 'PHARMACY').length || 0);
  }, 0);

  const prescriptionsFilled = pharmacyPatients.filter(p => 
    p.prescriptions && p.prescriptions.length > 0
  ).length;

  const totalPharmacyRevenue = pharmacyPatients.reduce((sum, p) => {
    return sum + (p.billItems?.filter(item => item.category === 'PHARMACY')
      .reduce((s, item) => s + item.amount, 0) || 0);
  }, 0);

  const startDate = dateRange.start instanceof Date ? dateRange.start : new Date();
  const endDate = dateRange.end instanceof Date ? dateRange.end : new Date();

  return {
    userId,
    userName,
    userEmail,
    role: UserRole.PHARMACIST,
    period: 'custom',
    dateRange: {
      start: formatDate(startDate.toISOString()),
      end: formatDate(endDate.toISOString()),
    },
    metrics: {
      medicationsDispensed,
      prescriptionsFilled,
      totalPharmacyRevenue,
    },
    details: {
      patients: pharmacyPatients,
      revenue: totalPharmacyRevenue,
    },
  };
};

/**
 * Calculate performance for Optical Dispenser role
 */
export const calculateOpticalDispenserPerformance = (
  userId: string,
  userName: string,
  userEmail: string,
  patients: Patient[],
  dateRange: { start: Date; end: Date }
): UserPerformance => {
  const filteredPatients = patients.filter(p => {
    const checkInDate = new Date(p.checkedInAt);
    return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
  });

  // Patients with optical items
  const opticalPatients = filteredPatients.filter(p => 
    p.status === PatientStatus.IN_OPTICAL ||
    p.status === PatientStatus.PENDING_BILLING ||
    (p.billItems?.some(item => item.category === 'OPTICAL') || false)
  );

  const framesDispensed = opticalPatients.filter(p => 
    p.billItems?.some(item => item.category === 'OPTICAL' && item.name?.toLowerCase().includes('frame'))
  ).length;

  const lensesDispensed = opticalPatients.filter(p => 
    p.billItems?.some(item => item.category === 'OPTICAL' && item.name?.toLowerCase().includes('lens'))
  ).length;

  const opticalRevenue = opticalPatients.reduce((sum, p) => {
    return sum + (p.billItems?.filter(item => item.category === 'OPTICAL')
      .reduce((s, item) => s + item.amount, 0) || 0);
  }, 0);

  const startDate = dateRange.start instanceof Date ? dateRange.start : new Date();
  const endDate = dateRange.end instanceof Date ? dateRange.end : new Date();

  return {
    userId,
    userName,
    userEmail,
    role: UserRole.OPTICAL_DISPENSER,
    period: 'custom',
    dateRange: {
      start: formatDate(startDate.toISOString()),
      end: formatDate(endDate.toISOString()),
    },
    metrics: {
      framesDispensed,
      lensesDispensed,
      opticalRevenue,
    },
    details: {
      patients: opticalPatients,
      revenue: opticalRevenue,
    },
  };
};

/**
 * Calculate performance for Billing Officer role
 */
export const calculateBillingOfficerPerformance = (
  userId: string,
  userName: string,
  userEmail: string,
  patients: Patient[],
  dateRange: { start: Date; end: Date }
): UserPerformance => {
  const filteredPatients = patients.filter(p => {
    const checkInDate = new Date(p.checkedInAt);
    return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
  });

  // Patients with completed billing
  const billedPatients = filteredPatients.filter(p => 
    p.status === PatientStatus.COMPLETED ||
    p.status === PatientStatus.PENDING_BILLING ||
    (p.billItems && p.billItems.length > 0)
  );

  const paymentsProcessed = billedPatients.length;
  const totalRevenueCollected = billedPatients.reduce((sum, p) => {
    return sum + calculateBillTotal(p.billItems);
  }, 0);

  const averageTransactionAmount = paymentsProcessed > 0 
    ? totalRevenueCollected / paymentsProcessed 
    : 0;

  const insuranceClaimsProcessed = billedPatients.filter(p => 
    p.insuranceType !== 'CASH'
  ).length;

  const startDate = dateRange.start instanceof Date ? dateRange.start : new Date();
  const endDate = dateRange.end instanceof Date ? dateRange.end : new Date();

  return {
    userId,
    userName,
    userEmail,
    role: UserRole.BILLING_OFFICER,
    period: 'custom',
    dateRange: {
      start: formatDate(startDate.toISOString()),
      end: formatDate(endDate.toISOString()),
    },
    metrics: {
      paymentsProcessed,
      totalRevenueCollected,
      averageTransactionAmount,
      insuranceClaimsProcessed,
    },
    details: {
      patients: billedPatients,
      revenue: totalRevenueCollected,
    },
  };
};

/**
 * Calculate performance for Manager role
 */
export const calculateManagerPerformance = (
  userId: string,
  userName: string,
  userEmail: string,
  patients: Patient[],
  dateRange: { start: Date; end: Date }
): UserPerformance => {
  const filteredPatients = patients.filter(p => {
    const checkInDate = new Date(p.checkedInAt);
    return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
  });

  const departmentsMonitored = new Set([
    ...filteredPatients.filter(p => p.status === PatientStatus.IN_CLINICAL).map(() => 'Clinical'),
    ...filteredPatients.filter(p => p.status === PatientStatus.IN_PHARMACY).map(() => 'Pharmacy'),
    ...filteredPatients.filter(p => p.status === PatientStatus.IN_OPTICAL).map(() => 'Optical'),
    ...filteredPatients.filter(p => p.status === PatientStatus.PENDING_BILLING).map(() => 'Billing'),
  ]).size;

  const startDate = dateRange.start instanceof Date ? dateRange.start : new Date();
  const endDate = dateRange.end instanceof Date ? dateRange.end : new Date();

  return {
    userId,
    userName,
    userEmail,
    role: UserRole.MANAGER,
    period: 'custom',
    dateRange: {
      start: formatDate(startDate.toISOString()),
      end: formatDate(endDate.toISOString()),
    },
    metrics: {
      totalPatientsOversaw: filteredPatients.length,
      departmentsMonitored,
      reportsGenerated: 0, // Would be tracked separately
    },
    details: {
      patients: filteredPatients,
    },
  };
};

/**
 * Get role-specific performance calculator
 */
export const getPerformanceCalculator = (role: UserRole) => {
  switch (role) {
    case UserRole.RECEPTIONIST:
      return calculateReceptionistPerformance;
    case UserRole.OPTOMETRIST:
      return calculateOptometristPerformance;
    case UserRole.PHARMACIST:
      return calculatePharmacistPerformance;
    case UserRole.OPTICAL_DISPENSER:
      return calculateOpticalDispenserPerformance;
    case UserRole.BILLING_OFFICER:
      return calculateBillingOfficerPerformance;
    case UserRole.MANAGER:
      return calculateManagerPerformance;
    default:
      return null;
  }
};
