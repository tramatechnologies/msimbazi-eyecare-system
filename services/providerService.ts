/**
 * Provider Service
 * Fetches providers (doctors/optometrists) directly from Supabase
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface Provider {
  id: string;
  userId?: string;
  name: string;
  role: string;
  specialization?: string;
  isNHIFVerified: boolean;
  status: 'AVAILABLE' | 'BUSY' | 'ON_BREAK' | 'OFFLINE';
  queue?: any[];
  email?: string;
}

/**
 * Fetch all providers from Supabase
 */
export async function getProviders(filters?: {
  role?: string;
  status?: string;
}): Promise<Provider[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  let query = supabase
    .from('providers')
    .select('*')
    .order('name', { ascending: true });

  if (filters?.role) {
    query = query.eq('role', filters.role);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching providers:', error);
    return [];
  }

  const rows = (data || []).filter((r: any) => r.is_active !== false);
  return rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    specialization: row.specialization ?? undefined,
    isNHIFVerified: !!row.is_nhif_verified,
    status: row.status,
    queue: [],
    email: undefined,
  }));
}

/**
 * Get available providers (status: AVAILABLE or ON_BREAK)
 */
export async function getAvailableProviders(role?: string): Promise<Provider[]> {
  const providers = await getProviders({ role });
  return providers.filter(
    (p) => p.status === 'AVAILABLE' || p.status === 'ON_BREAK'
  );
}

/**
 * Get all doctors for scheduling dropdown (OPTOMETRIST + OPHTHALMOLOGIST, any status).
 * Use this for "Assign Doctor" so admin-added doctors always appear.
 */
export async function getProvidersForScheduling(): Promise<Provider[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .in('role', ['OPTOMETRIST', 'OPHTHALMOLOGIST'])
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching providers for scheduling:', error);
    return [];
  }

  const rows = (data || []).filter((r: any) => r.is_active !== false);
  return rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    specialization: row.specialization ?? undefined,
    isNHIFVerified: !!row.is_nhif_verified,
    status: row.status,
    queue: [],
    email: undefined,
  }));
}
