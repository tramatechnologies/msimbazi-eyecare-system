/**
 * ICD-10 Service
 * Fetches ICD-10 codes directly from Supabase
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface ICD10Code {
  code: string;
  description: string;
  category?: string;
}

/**
 * Fetch active ICD-10 codes from Supabase
 */
export async function getICD10Codes(filters?: {
  search?: string;
  category?: string;
}): Promise<ICD10Code[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  let query = supabase
    .from('icd10_codes')
    .select('code, description, category')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (filters?.search) {
    query = query.or(
      `code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching ICD-10 codes:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    code: row.code,
    description: row.description,
    category: row.category ?? undefined,
  }));
}
