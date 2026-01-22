/**
 * NHIF Service
 * Handles NHIF API integration, token management, and verification
 */

import { NHIFVerification } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface NHIFVerifyRequest {
  cardNo: string;
  visitTypeId: number; // 1=Normal, 2=Emergency, 3=Referral, 4=Follow-up
  referralNo?: string; // Required for Referral (3) and Follow-up (4)
  remarks?: string;
}

export interface NHIFVerifyResponse {
  success: boolean;
  authorizationStatus: 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'UNKNOWN' | 'INVALID';
  authorizationNo?: string;
  cardStatus?: string;
  memberName?: string;
  remarks?: string;
  responsePayload?: any;
  error?: string;
}

export interface NHIFTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Verify NHIF card via backend API proxy
 */
export const verifyNHIF = async (
  request: NHIFVerifyRequest,
  visitId: string
): Promise<NHIFVerifyResponse> => {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return {
        success: false,
        authorizationStatus: 'REJECTED',
        error: 'Authentication required',
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/nhif/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...request,
        visitId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        authorizationStatus: 'REJECTED',
        error: errorData.error || 'NHIF verification failed',
      };
    }

    const data = await response.json();
    return {
      success: true,
      authorizationStatus: data.authorizationStatus,
      authorizationNo: data.authorizationNo,
      cardStatus: data.cardStatus,
      memberName: data.memberName,
      remarks: data.remarks,
      responsePayload: data.responsePayload,
    };
  } catch (error: any) {
    console.error('NHIF verification error:', error);
    return {
      success: false,
      authorizationStatus: 'REJECTED',
      error: error.message || 'Network error during NHIF verification',
    };
  }
};

/**
 * Get active NHIF verification for a visit
 */
export const getActiveNHIFVerification = async (
  visitId: string
): Promise<NHIFVerification | null> => {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/nhif/verification/${visitId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.verification || null;
  } catch (error) {
    console.error('Error fetching NHIF verification:', error);
    return null;
  }
};

/**
 * Create a new visit
 */
export const createVisit = async (
  patientId: string,
  payerType: 'CASH' | 'INSURANCE',
  insuranceProvider?: string,
  department: string = 'OPTOMETRY'
): Promise<{ success: boolean; visitId?: string; error?: string }> => {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        patientId,
        payerType,
        insuranceProvider,
        department,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to create visit' };
    }

    const data = await response.json();
    return { success: true, visitId: data.visitId };
  } catch (error: any) {
    console.error('Error creating visit:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

/**
 * Get visit by ID
 */
export const getVisit = async (
  visitId: string
): Promise<{ success: boolean; visit?: any; error?: string }> => {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/visits/${visitId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to fetch visit' };
    }

    const data = await response.json();
    return { success: true, visit: data.visit };
  } catch (error: any) {
    console.error('Error fetching visit:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

/**
 * Get visit for a patient (most recent active visit)
 */
export const getPatientVisit = async (
  patientId: string
): Promise<{ success: boolean; visit?: any; error?: string }> => {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/visits/patient/${patientId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to fetch visit' };
    }

    const data = await response.json();
    return { success: true, visit: data.visit };
  } catch (error: any) {
    console.error('Error fetching patient visit:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

/**
 * Convert visit from NHIF to CASH (override)
 */
export const convertVisitToCash = async (
  visitId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/visits/${visitId}/convert-to-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to convert visit' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error converting visit to cash:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};
