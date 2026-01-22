/**
 * Patient-related utility functions
 * Centralizes common patient operations
 */

import { Patient, PatientStatus, InsuranceType, BillItem, Medication } from '../types';
import { INSURANCE_COVERAGE } from '../constants';

/**
 * Gets CSS classes for patient status badge
 */
export const getStatusColor = (status: PatientStatus): string => {
  const colorMap: Record<PatientStatus, string> = {
    [PatientStatus.ARRIVED]: 'bg-slate-100 text-slate-500',
    [PatientStatus.WAITING]: 'bg-orange-100 text-orange-600',
    [PatientStatus.IN_CLINICAL]: 'bg-blue-100 text-blue-600',
    [PatientStatus.PENDING_TREATMENT]: 'bg-yellow-100 text-yellow-600',
    [PatientStatus.IN_PHARMACY]: 'bg-emerald-100 text-emerald-600',
    [PatientStatus.IN_OPTICAL]: 'bg-cyan-100 text-cyan-600',
    [PatientStatus.PENDING_BILLING]: 'bg-purple-100 text-purple-600',
    [PatientStatus.COMPLETED]: 'bg-emerald-100 text-emerald-600',
    [PatientStatus.CANCELLED]: 'bg-red-100 text-red-600',
  };
  
  return colorMap[status] || 'bg-slate-100 text-slate-500';
};

/**
 * Checks if a bill item or medication is covered by insurance
 */
export const isInsuranceEligible = (
  item: BillItem | Medication,
  insuranceType: InsuranceType
): boolean => {
  if (insuranceType === InsuranceType.NHIF) {
    return item.isCoveredByNHIF;
  }
  
  if (insuranceType === InsuranceType.PRIVATE) {
    return item.isCoveredByPrivate ?? false;
  }
  
  return false;
};

/**
 * Calculates total bill amount
 */
export const calculateBillTotal = (items: BillItem[]): number => {
  return items.reduce((sum, item) => sum + item.amount, 0);
};

/**
 * Calculates insurance coverage amount
 */
export const calculateInsuranceCoverage = (
  patient: Patient,
  coveragePercentage: number = INSURANCE_COVERAGE.PRIVATE_DEFAULT_PERCENTAGE
): number => {
  return patient.billItems.reduce((sum, item) => {
    if (isInsuranceEligible(item, patient.insuranceType)) {
      if (patient.insuranceType === InsuranceType.NHIF) {
        // NHIF covers full amount if eligible
        return sum + item.amount;
      }
      if (patient.insuranceType === InsuranceType.PRIVATE) {
        // Private insurance covers percentage
        return sum + (item.amount * coveragePercentage);
      }
    }
    return sum;
  }, 0);
};

/**
 * Formats patient name for display
 */
export const formatPatientName = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Gets patient initials for avatar
 */
export const getPatientInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Formats phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Format: 07XX XXX XXX
  return phone.replace(/(\d{2})(\d{3})(\d{3})(\d{2})/, '$1 $2 $3 $4');
};

/**
 * Calculates patient age from date of birth
 */
export const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Filters patients by status
 */
export const filterPatientsByStatus = (
  patients: Patient[],
  status: PatientStatus | 'ALL'
): Patient[] => {
  if (status === 'ALL') return patients;
  return patients.filter(p => p.status === status);
};

/**
 * Searches patients by name or ID
 */
export const searchPatients = (patients: Patient[], searchTerm: string): Patient[] => {
  if (!searchTerm.trim()) return [];
  
  const term = searchTerm.toLowerCase().trim();
  return patients.filter(p => 
    p.name.toLowerCase().includes(term) || 
    p.id.toLowerCase().includes(term) ||
    p.phone.includes(term)
  );
};
