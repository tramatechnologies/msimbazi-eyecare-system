/**
 * Patient Context for global state management
 * Replaces prop drilling with centralized state
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Patient } from '../types';
import { storageService } from '../services/storageService';
import { validatePatient, ValidationResult } from '../utils/validation';
import { generatePatientId } from '../utils/idGenerator';
import { handleError } from '../utils/errorHandler';

interface PatientContextType {
  patients: Patient[];
  addPatient: (patient: Partial<Patient>) => Promise<{ success: boolean; error?: string; patient?: Patient }>;
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<{ success: boolean; error?: string }>;
  deletePatient: (id: string) => Promise<{ success: boolean; error?: string }>;
  getPatient: (id: string) => Patient | undefined;
  isLoading: boolean;
  error: string | null;
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

  // Load patients from storage on mount (runs once)
  useEffect(() => {
    try {
      const savedPatients = storageService.loadPatients(initialPatients);
      if (savedPatients.length > 0) {
        setPatients(savedPatients);
      }
      hasLoadedRef.current = true;
    } catch (err) {
      setError(handleError(err));
      hasLoadedRef.current = true; // Mark as loaded even on error
    }
  }, []);

  // Save patients to storage whenever they change (only after initial load)
  useEffect(() => {
    if (hasLoadedRef.current) {
      try {
        storageService.savePatients(patients);
      } catch (err) {
        console.error('Failed to save patients:', err);
        // Don't set error state here to avoid infinite loops
      }
    }
  }, [patients]);

  const addPatient = useCallback(async (
    patientData: Partial<Patient>
  ): Promise<{ success: boolean; error?: string; patient?: Patient }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate patient data
      const validation: ValidationResult = validatePatient(patientData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Generate ID if not provided
      // Auto-generate checkedInAt timestamp if not provided
      const newPatient: Patient = {
        ...patientData as Patient,
        id: patientData.id || generatePatientId(patients),
        status: patientData.status || 'WAITING',
        checkedInAt: patientData.checkedInAt || new Date().toISOString(), // Auto-generated timestamp
        billItems: patientData.billItems || [],
      };

      setPatients(prev => [...prev, newPatient]);
      
      return {
        success: true,
        patient: newPatient
      };
    } catch (err) {
      const errorMessage = handleError(err);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePatient = useCallback(async (
    id: string,
    updates: Partial<Patient>
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if patient exists before updating
      setPatients(prev => {
        const patientExists = prev.some(p => p.id === id);
        if (!patientExists) {
          throw new Error(`Patient with ID ${id} not found`);
        }
        return prev.map(p => 
          p.id === id ? { ...p, ...updates } : p
        );
      });
      
      return { success: true };
    } catch (err) {
      const errorMessage = handleError(err);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deletePatient = useCallback(async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      setPatients(prev => prev.filter(p => p.id !== id));
      return { success: true };
    } catch (err) {
      const errorMessage = handleError(err);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPatient = useCallback((id: string): Patient | undefined => {
    return patients.find(p => p.id === id);
  }, [patients]);

  const value: PatientContextType = {
    patients,
    addPatient,
    updatePatient,
    deletePatient,
    getPatient,
    isLoading,
    error,
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};
