/**
 * Medication Service
 * Fetches medications directly from Supabase
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface Medication {
  id: string;
  name: string;
  dosage?: string;
  form: string;
  price: number;
  stock: number;
  isCoveredByNHIF: boolean;
  isCoveredByPrivate: boolean;
}

/**
 * Fetch active medications from Supabase
 */
export async function getMedications(filters?: {
  search?: string;
  form?: string;
  isCoveredByNHIF?: boolean;
}): Promise<Medication[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  let query = supabase
    .from('medications')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  if (filters?.form) {
    query = query.eq('form', filters.form);
  }
  if (filters?.isCoveredByNHIF !== undefined) {
    query = query.eq('is_covered_by_nhif', filters.isCoveredByNHIF);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching medications:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    dosage: row.dosage ?? undefined,
    form: row.form,
    price: typeof row.price === 'number' ? row.price : parseFloat(row.price) || 0,
    stock: row.stock ?? 0,
    isCoveredByNHIF: !!row.is_covered_by_nhif,
    isCoveredByPrivate: row.is_covered_by_private !== false,
  }));
}
