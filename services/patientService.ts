/**
 * Patient Service
 * Handles all patient-related API calls with proper authentication
 */

import type { Patient } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * True when API persistence can be used (auth token + API URL configured).
 */
export const isApiAvailable = (): boolean => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;
  return !!(token && API_BASE_URL);
};

/**
 * Map API patient (snake_case or backend shape) to frontend Patient.
 */
export const mapPatientFromApi = (raw: Record<string, unknown>): Patient => {
  const p = raw as any;
  return {
    id: p.id ?? p.patient_number ?? '',
    name: p.name ?? '',
    phone: p.phone ?? '',
    email: p.email ?? undefined,
    dob: p.dob ?? '',
    address: p.address ?? undefined,
    gender: p.gender ?? 'Male',
    insuranceType: p.insurance_type ?? p.insuranceType ?? 'CASH',
    insuranceProvider: p.insurance_provider ?? p.insuranceProvider,
    insuranceNumber: p.insurance_policy_number ?? p.insurance_member_number ?? p.insuranceNumber,
    nhifAuthNumber: p.nhif_auth_number ?? p.nhifAuthNumber,
    status: p.status ?? 'WAITING',
    assignedProviderId: p.assigned_provider_id ?? p.assignedProviderId,
    checkedInAt: p.checked_in_at ?? p.checkedInAt ?? p.created_at ?? new Date().toISOString(),
    chiefComplaint: p.chief_complaint ?? p.chiefComplaint,
    clinicalNotes: p.clinical_notes ?? p.clinicalNotes,
    consultationNotes: p.consultation_notes ?? p.consultationNotes,
    ophthalmologistNotes: p.ophthalmologist_notes ?? p.ophthalmologistNotes,
    diagnosis: p.diagnosis ?? undefined,
    appointment: p.appointment ?? p.appointment,
    prescription: p.prescription ?? undefined,
    billItems: Array.isArray(p.billItems) ? p.billItems : Array.isArray(p.bill_items) ? (p.bill_items as any[]).map((b: any) => ({
      id: b.external_id ?? b.id,
      description: b.description,
      amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount) || 0,
      category: b.category,
      isCoveredByNHIF: !!(b.is_covered_by_nhif ?? b.isCoveredByNHIF),
      isCoveredByPrivate: (b.is_covered_by_private ?? b.isCoveredByPrivate) !== false,
    })) : [],
    prescriptionHistory: p.prescriptionHistory ?? [],
  };
};

/**
 * Get authorization header
 */
const getAuthHeader = () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Handle API response errors
 */
const handleResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data;
};

/**
 * Create a new patient
 */
export const createPatient = async (patientData: any) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(patientData),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating patient:', error);
    throw error;
  }
};

/**
 * Get patient by ID
 */
export const getPatient = async (patientId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching patient:', error);
    throw error;
  }
};

/**
 * Update patient
 */
export const updatePatient = async (patientId: string, updates: any) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(updates),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
};

/**
 * List patients with filters and pagination
 */
export const listPatients = async (options: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
} = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.search) params.append('search', options.search);
    if (options.status) params.append('status', options.status);

    const response = await fetch(`${API_BASE_URL}/api/patients?${params}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error listing patients:', error);
    throw error;
  }
};

/**
 * Delete patient (soft delete)
 */
export const deletePatient = async (patientId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting patient:', error);
    throw error;
  }
};

/**
 * Create prescription for patient
 */
export const createPrescription = async (patientId: string, prescriptionData: any) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/prescriptions`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(prescriptionData),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating prescription:', error);
    throw error;
  }
};

/**
 * Create bill item for patient
 */
export const createBillItem = async (patientId: string, billItemData: any) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/bill-items`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(billItemData),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating bill item:', error);
    throw error;
  }
};

/**
 * Get patient's prescription history
 */
export const getPrescriptionHistory = async (patientId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/prescriptions/history`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching prescription history:', error);
    throw error;
  }
};

/**
 * Get patient's billing information
 */
export const getPatientBilling = async (patientId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/billing`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching patient billing:', error);
    throw error;
  }
};

/**
 * Search patients
 */
export const searchPatients = async (searchTerm: string, limit: number = 5) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/patients?search=${encodeURIComponent(searchTerm)}&limit=${limit}`,
      {
        method: 'GET',
        headers: getAuthHeader(),
      }
    );

    return await handleResponse(response);
  } catch (error) {
    console.error('Error searching patients:', error);
    throw error;
  }
};
