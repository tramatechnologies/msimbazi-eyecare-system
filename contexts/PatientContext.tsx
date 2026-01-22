/**
 * Patient Context for global state management
 * Replaces prop drilling with centralized state.
 * When authToken + VITE_API_URL exist, uses API for persistence; otherwise localStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Patient } from '../types';
import { storageService } from '../services/storageService';
import {
  isApiAvailable,
  mapPatientFromApi,
  listPatients,
  createPatient as apiCreatePatient,
  updatePatient as apiUpdatePatient,
  deletePatient as apiDeletePatient,
  getPatient as apiGetPatient,
} from '../services/patientService';
import { validatePatient, ValidationResult } from '../utils/validation';
import { generatePatientId } from '../utils/idGenerator';
import { handleError } from '../utils/errorHandler';

interface PatientContextType {
  patients: Patient[];
  addPatient: (patient: Partial<Patient>) => Promise<{ success: boolean; error?: string; patient?: Patient }>;
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<{ success: boolean; error?: string }>;
  deletePatient: (id: string) => Promise<{ success: boolean; error?: string }>;
  getPatient: (id: string) => Patient | undefined;
  refreshPatient: (id: string) => Promise<Patient | null>;
  isLoading: boolean;
  error: string | null;
  useApi: boolean;
}

const PatientContext = createContext<PatientContextType | null>(null);

export const usePatients = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatients must be used within PatientProvider');
  }
  return context;
};

interface PatientProviderProps {
  children: React.ReactNode;
  initialPatients?: Patient[];
}

export const PatientProvider: React.FC<PatientProviderProps> = ({ 
  children, 
  initialPatients = [] 
}) => {
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const useApi = isApiAvailable();

  // Load patients on mount: from API if available, else localStorage
  useEffect(() => {
    const load = async () => {
      try {
        if (useApi) {
          const res = await listPatients({ page: 1, limit: 500 });
          const list = (res.patients ?? []) as Record<string, unknown>[];
          const mapped = list.map((r) => mapPatientFromApi(r));
          if (mapped.length > 0) setPatients(mapped);
        } else {
          const savedPatients = storageService.loadPatients(initialPatients);
          if (savedPatients.length > 0) setPatients(savedPatients);
        }
      } catch (err) {
        if (useApi) setError(handleError(err));
        else {
          try {
            const savedPatients = storageService.loadPatients(initialPatients);
            if (savedPatients.length > 0) setPatients(savedPatients);
          } catch (e) {
            setError(handleError(e));
          }
        }
      } finally {
        hasLoadedRef.current = true;
      }
    };
    load();
  }, [useApi]);

  // Save patients to localStorage when they change (only when not using API)
  useEffect(() => {
    if (hasLoadedRef.current && !useApi) {
      try {
        storageService.savePatients(patients);
      } catch (err) {
        console.error('Failed to save patients:', err);
      }
    }
  }, [patients, useApi]);

  const addPatient = useCallback(async (
    patientData: Partial<Patient>
  ): Promise<{ success: boolean; error?: string; patient?: Patient }> => {
    setIsLoading(true);
    setError(null);

    try {
      const validation: ValidationResult = validatePatient(patientData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      if (useApi) {
        const payload: Record<string, unknown> = {
          name: patientData.name,
          phone: patientData.phone,
          email: patientData.email ?? null,
          dob: patientData.dob,
          gender: patientData.gender ?? 'Male',
          address: patientData.address ?? '',
          insuranceType: patientData.insuranceType ?? 'CASH',
          insuranceProvider: patientData.insuranceProvider ?? null,
          insuranceNumber: patientData.insuranceNumber ?? '',
          nhifAuthNumber: patientData.nhifAuthNumber ?? '',
        };
        const res = await apiCreatePatient(payload);
        let created = mapPatientFromApi((res as any).patient ?? {});
        if (patientData.appointment || (patientData.billItems && patientData.billItems.length > 0)) {
          await apiUpdatePatient(created.id, {
            status: patientData.status ?? 'WAITING',
            appointment: patientData.appointment ?? undefined,
            billItems: patientData.billItems ?? [],
          });
        }
        created = {
          ...created,
          status: patientData.status ?? 'WAITING',
          checkedInAt: patientData.checkedInAt ?? new Date().toISOString(),
          appointment: patientData.appointment ?? created.appointment,
          billItems: patientData.billItems ?? created.billItems ?? [],
        };
        setPatients((prev) => [...prev, created]);
        return { success: true, patient: created };
      }

      const newPatient: Patient = {
        ...patientData as Patient,
        id: patientData.id || generatePatientId(patients),
        status: patientData.status || 'WAITING',
        checkedInAt: patientData.checkedInAt || new Date().toISOString(),
        billItems: patientData.billItems || [],
      };
      setPatients((prev) => [...prev, newPatient]);
      return { success: true, patient: newPatient };
    } catch (err) {
      const errorMessage = handleError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [useApi, patients]);

  const updatePatient = useCallback(async (
    id: string,
    updates: Partial<Patient>
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      if (useApi) {
        const res = await apiUpdatePatient(id, updates);
        const updated = (res as any).patient;
        if (updated) {
          const mapped = mapPatientFromApi(updated);
          setPatients((prev) => {
            const idx = prev.findIndex((p) => p.id === id);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = mapped;
            return next;
          });
        } else {
          setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
        }
        return { success: true };
      }

      setPatients((prev) => {
        const patientExists = prev.some((p) => p.id === id);
        if (!patientExists) throw new Error(`Patient with ID ${id} not found`);
        return prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      });
      return { success: true };
    } catch (err) {
      const errorMessage = handleError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [useApi]);

  const deletePatient = useCallback(async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      if (useApi) {
        await apiDeletePatient(id);
      }
      setPatients((prev) => prev.filter((p) => p.id !== id));
      return { success: true };
    } catch (err) {
      const errorMessage = handleError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [useApi]);

  const getPatient = useCallback((id: string): Patient | undefined => {
    return patients.find((p) => p.id === id);
  }, [patients]);

  const refreshPatient = useCallback(async (id: string): Promise<Patient | null> => {
    if (!useApi) return getPatient(id) ?? null;
    try {
      const res = await apiGetPatient(id);
      const data = (res as any)?.patient;
      if (!data) return null;
      const mapped = mapPatientFromApi(data);
      setPatients((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) return [...prev, mapped];
        const next = [...prev];
        next[idx] = mapped;
        return next;
      });
      return mapped;
    } catch {
      return getPatient(id) ?? null;
    }
  }, [useApi, getPatient]);

  const value: PatientContextType = {
    patients,
    addPatient,
    updatePatient,
    deletePatient,
    getPatient,
    refreshPatient,
    isLoading,
    error,
    useApi,
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};
