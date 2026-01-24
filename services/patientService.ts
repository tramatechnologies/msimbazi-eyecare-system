/**
 * Patient Service
 * Uses Supabase directly when configured; otherwise API (or localStorage via PatientContext).
 */

import type { Patient } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * True when API persistence can be used (auth token + API URL configured).
 * @deprecated Prefer isSupabaseConfigured for direct-Supabase mode.
 */
export const isApiAvailable = (): boolean => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;
  return !!(token && API_BASE_URL);
};

/**
 * Use Supabase for patients when configured (direct-Supabase backend).
 * Otherwise fall back to API (when running Express) or localStorage.
 */
export const useSupabaseForPatients = (): boolean => isSupabaseConfigured();

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
    insuranceProvider: (p.insurance_type ?? p.insuranceType) === 'CASH' ? undefined : (p.insurance_provider ?? p.insuranceProvider),
    insuranceNumber: (p.insurance_type ?? p.insuranceType) === 'CASH' ? undefined : (p.insurance_policy_number ?? p.insurance_member_number ?? p.insuranceNumber),
    nhifAuthNumber: (p.insurance_type ?? p.insuranceType) === 'CASH' ? undefined : (p.nhif_auth_number ?? p.nhifAuthNumber),
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
  if (useSupabaseForPatients()) {
    return createPatientSupabase(patientData);
  }
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

async function createPatientSupabase(patientData: any): Promise<{ success: boolean; patient?: any; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const { data: last } = await supabase
      .from('patients')
      .select('patient_id, patient_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastVal = last?.patient_id ?? last?.patient_number;
    let next = 1;
    if (lastVal) {
      const m = String(lastVal).match(/P0*(\d+)/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    const seqId = `P${String(next).padStart(3, '0')}`;

    const { data: row, error } = await supabase
      .from('patients')
      .insert({
        patient_number: seqId,
        name: String(patientData.name ?? '').trim(),
        phone: String(patientData.phone ?? '').trim(),
        email: patientData.email ? String(patientData.email).trim() : null,
        dob: patientData.dob ?? '',
        gender: patientData.gender ?? 'Male',
        address: patientData.address ? String(patientData.address).trim() : '',
        insurance_type: patientData.insuranceType ?? 'CASH',
        insurance_provider: patientData.insuranceProvider ?? null,
        insurance_policy_number: patientData.insuranceNumber ?? null,
        insurance_member_number: patientData.insuranceNumber ?? null,
        nhif_auth_number: patientData.nhifAuthNumber ?? null,
        created_by: userId,
        registered_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase create patient:', error);
      return { success: false, error: error.message };
    }
    return { success: true, patient: row };
  } catch (e: any) {
    console.error('createPatientSupabase:', e);
    return { success: false, error: e?.message ?? 'Failed to create patient' };
  }
}

/**
 * Get patient by ID
 */
export const getPatient = async (patientId: string) => {
  if (useSupabaseForPatients()) {
    return getPatientSupabase(patientId);
  }
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

async function getPatientSupabase(patientId: string): Promise<{ success: boolean; patient?: any }> {
  try {
    const supabase = getSupabase();
    const { data: patient, error: pe } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .maybeSingle();

    if (pe || !patient) return { success: false };

    let prescriptions: any[] = [];
    let billItems: any[] = [];
    try {
      const [rx, bi] = await Promise.all([
        supabase.from('prescriptions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('bill_items').select('*').eq('patient_id', patientId),
      ]);
      if (!rx.error) prescriptions = rx.data ?? [];
      if (!bi.error) billItems = bi.data ?? [];
    } catch (_) {}

    const latest = prescriptions[0];
    const prescription = latest
      ? {
          od: latest.od,
          os: latest.os,
          add: latest.add_od || latest.add_os,
          addOd: latest.add_od,
          addOs: latest.add_os,
          edgeColor: latest.edge_color,
          medications: latest.medications ?? [],
        }
      : undefined;

    const billItemsMapped = billItems.map((b: any) => ({
      id: b.external_id ?? b.id,
      description: b.description,
      amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount) || 0,
      category: b.category,
      isCoveredByNHIF: !!(b.is_covered_by_nhif ?? b.isCoveredByNHIF),
      isCoveredByPrivate: (b.is_covered_by_private ?? b.isCoveredByPrivate) !== false,
    }));

    const out = { ...patient, prescription, billItems: billItemsMapped, bill_items: billItemsMapped };
    return { success: true, patient: out };
  } catch (e) {
    console.error('getPatientSupabase:', e);
    return { success: false };
  }
}

/**
 * Update patient
 */
export const updatePatient = async (patientId: string, updates: any) => {
  if (useSupabaseForPatients()) {
    return updatePatientSupabase(patientId, updates);
  }
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

async function updatePatientSupabase(
  patientId: string,
  updates: any
): Promise<{ success: boolean; patient?: any; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const u: Record<string, any> = { updated_by: userId, updated_at: new Date().toISOString() };
    if (updates.name !== undefined) u.name = String(updates.name).trim();
    if (updates.phone !== undefined) u.phone = String(updates.phone).trim();
    if (updates.email !== undefined) u.email = updates.email ? String(updates.email).trim() : null;
    if (updates.dob !== undefined) u.dob = updates.dob;
    if (updates.gender !== undefined) u.gender = updates.gender;
    if (updates.address !== undefined) u.address = String(updates.address || '').trim();
    if (updates.insuranceType !== undefined) u.insurance_type = updates.insuranceType;
    if (updates.insuranceProvider !== undefined) u.insurance_provider = updates.insuranceProvider;
    if (updates.insuranceNumber !== undefined) {
      u.insurance_policy_number = updates.insuranceNumber;
      u.insurance_member_number = updates.insuranceNumber;
    }
    if (updates.nhifAuthNumber !== undefined) u.nhif_auth_number = updates.nhifAuthNumber;
    if (updates.status !== undefined) u.status = updates.status;
    if (updates.checkedInAt !== undefined) u.checked_in_at = updates.checkedInAt;
    if (updates.assignedProviderId !== undefined) u.assigned_provider_id = updates.assignedProviderId ?? null;
    if (updates.chiefComplaint !== undefined) u.chief_complaint = updates.chiefComplaint;
    if (updates.clinicalNotes !== undefined) u.clinical_notes = updates.clinicalNotes;
    if (updates.consultationNotes !== undefined) u.consultation_notes = updates.consultationNotes;
    if (updates.ophthalmologistNotes !== undefined) u.ophthalmologist_notes = updates.ophthalmologistNotes;
    if (updates.diagnosis !== undefined) u.diagnosis = updates.diagnosis;
    if (updates.appointment !== undefined) u.appointment = updates.appointment;

    const { data: updated, error } = await supabase
      .from('patients')
      .update(u)
      .eq('id', patientId)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase update patient:', error);
      return { success: false, error: error.message };
    }

    if (Array.isArray(updates.billItems) && updates.billItems.length > 0) {
      await supabase.from('bill_items').delete().eq('patient_id', patientId);
      for (const it of updates.billItems) {
        await supabase.from('bill_items').insert({
          patient_id: patientId,
          external_id: it.id,
          description: String(it.description ?? '').trim(),
          amount: parseFloat(it.amount) || 0,
          category: it.category ?? 'CLINICAL',
          is_covered_by_nhif: !!it.isCoveredByNHIF,
          is_covered_by_private: it.isCoveredByPrivate !== false,
          created_by: userId,
        });
      }
      const res = await getPatientSupabase(patientId);
      return { success: true, patient: res.patient ?? updated };
    }

    return { success: true, patient: updated };
  } catch (e: any) {
    console.error('updatePatientSupabase:', e);
    return { success: false, error: e?.message ?? 'Failed to update patient' };
  }
}

/**
 * List patients with filters and pagination
 */
export const listPatients = async (options: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
} = {}) => {
  if (useSupabaseForPatients()) {
    return listPatientsSupabase(options);
  }
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

async function listPatientsSupabase(options: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
} = {}) {
  try {
    const supabase = getSupabase();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(500, Math.max(1, options.limit ?? 500));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false, nullsFirst: false });

    if (options.search?.trim()) {
      query = query.or(`name.ilike.%${options.search.trim()}%,phone.ilike.%${options.search.trim()}%`);
    }
    if (options.status?.trim()) {
      query = query.eq('status', options.status.trim());
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase list patients:', error);
      return { patients: [], pagination: { page, limit, total: 0, pages: 0 } };
    }

    return {
      patients: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        pages: Math.ceil((count ?? 0) / limit),
      },
    };
  } catch (e) {
    console.error('listPatientsSupabase:', e);
    return { patients: [], pagination: { page: 1, limit: 500, total: 0, pages: 0 } };
  }
}

/**
 * Delete patient (soft delete)
 */
export const deletePatient = async (patientId: string) => {
  if (useSupabaseForPatients()) {
    return deletePatientSupabase(patientId);
  }
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

async function deletePatientSupabase(patientId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('patients')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', patientId);

  if (error) {
    console.error('Supabase delete patient:', error);
    throw new Error(error.message);
  }
}

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
