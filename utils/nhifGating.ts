/**
 * NHIF Service Gating Utilities
 * Functions to check if services can be provided based on NHIF verification status
 */

import { AuthorizationStatus } from '../types';
import { getActiveNHIFVerification } from '../services/nhifService';

export interface ServiceGateResult {
  allowed: boolean;
  reason?: string;
  verification?: any;
}

/**
 * Check if service can be provided for NHIF patient
 */
export const checkNHIFServiceGate = async (
  visitId: string | null,
  serviceName: string
): Promise<ServiceGateResult> => {
  if (!visitId) {
    return {
      allowed: false,
      reason: 'Visit ID is required for NHIF verification check',
    };
  }

  const verification = await getActiveNHIFVerification(visitId);

  if (!verification) {
    return {
      allowed: false,
      reason: 'NHIF verification not found. Please verify NHIF card before providing services.',
    };
  }

  // Hard gate: Only ACCEPTED allows services
  if (verification.authorizationStatus === AuthorizationStatus.ACCEPTED) {
    return {
      allowed: true,
      verification,
    };
  }

  // UNKNOWN allows with warning
  if (verification.authorizationStatus === AuthorizationStatus.UNKNOWN) {
    return {
      allowed: true,
      reason: 'NHIF verification returned UNKNOWN status. Patient should verify at NHIF office.',
      verification,
    };
  }

  // REJECTED, INVALID, PENDING block services
  const statusMessages: Record<string, string> = {
    REJECTED: 'NHIF verification was rejected. Services cannot be provided under NHIF.',
    INVALID: 'NHIF card is invalid. Services cannot be provided under NHIF.',
    PENDING: 'NHIF verification is pending. Please wait for verification to complete.',
  };

  return {
    allowed: false,
    reason: statusMessages[verification.authorizationStatus] || 'NHIF verification failed. Services cannot be provided.',
    verification,
  };
};

/**
 * Check if consultation can start
 */
export const canStartConsultation = async (visitId: string | null): Promise<ServiceGateResult> => {
  return checkNHIFServiceGate(visitId, 'Consultation');
};

/**
 * Check if lab orders can be placed
 */
export const canOrderLabs = async (visitId: string | null): Promise<ServiceGateResult> => {
  return checkNHIFServiceGate(visitId, 'Lab Orders');
};

/**
 * Check if medications can be dispensed
 */
export const canDispenseMedications = async (visitId: string | null): Promise<ServiceGateResult> => {
  return checkNHIFServiceGate(visitId, 'Medication Dispensing');
};

/**
 * Check if optical items can be dispensed
 */
export const canDispenseOptical = async (visitId: string | null): Promise<ServiceGateResult> => {
  return checkNHIFServiceGate(visitId, 'Optical Dispensing');
};

/**
 * Check if invoice can be created
 */
export const canCreateInvoice = async (visitId: string | null): Promise<ServiceGateResult> => {
  return checkNHIFServiceGate(visitId, 'Invoice Creation');
};
