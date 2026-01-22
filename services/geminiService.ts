/**
 * AI Clinical Support Service
 * Now uses backend proxy to protect API keys
 */

import { NetworkError, AppError, retry } from '../utils/errorHandler';
import { UI_TIMING } from '../constants';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const REQUEST_TIMEOUT = UI_TIMING.AI_REQUEST_TIMEOUT;

/**
 * Generic AI request handler with retry logic
 */
const makeAIRequest = async (
  endpoint: string,
  payload: any,
  signal?: AbortSignal
): Promise<string> => {
  const fetchResponse = async (): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 0 || response.status >= 500) {
          throw new NetworkError('Unable to connect to AI service');
        }
        if (response.status === 429) {
          throw new AppError(
            'Rate limit exceeded',
            'RATE_LIMIT_ERROR',
            'Too many requests. Please wait a moment and try again.',
            429
          );
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new AppError(
            errorData.error || 'Invalid request',
            'VALIDATION_ERROR',
            errorData.error || 'Please check your input and try again.',
            400
          );
        }
        throw new AppError(
          `API error: ${response.statusText}`,
          'API_ERROR',
          'Failed to fetch AI suggestions. Please try again.',
          response.status
        );
      }

      const data = await response.json();
      return data.suggestion || data.insights || 'No suggestions available.';
    } catch (error) {
      if (error instanceof NetworkError || error instanceof AppError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(
          'Request timeout',
          'TIMEOUT_ERROR',
          'The request took too long. Please try again.',
          408
        );
      }
      throw new AppError(
        'Failed to fetch AI suggestions',
        'UNKNOWN_ERROR',
        'An unexpected error occurred. Please try again later.',
        500
      );
    }
  };

  try {
    return await retry(fetchResponse, 3, 1000);
  } catch (error) {
    console.error('Gemini AI Error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'AI suggestions currently unavailable',
      'SERVICE_UNAVAILABLE',
      'The AI suggestions service is temporarily unavailable. Please try again later.',
      503
    );
  }
};

/**
 * Gets clinical support insights from AI
 * API key is protected on the backend
 */
export const getClinicalSupport = async (
  chiefComplaint: string,
  notes: string,
  signal?: AbortSignal
): Promise<string> => {
  if (!chiefComplaint && !notes) {
    throw new AppError(
      'Missing required fields',
      'VALIDATION_ERROR',
      'Please provide either a chief complaint or clinical notes.',
      400
    );
  }

  return makeAIRequest(
    '/api/clinical/ai-insights',
    { chiefComplaint: chiefComplaint || '', notes: notes || '' },
    signal
  );
};

/**
 * Gets AI diagnosis suggestions based on examination findings
 */
export const getDiagnosisSuggestion = async (
  chiefComplaint: string,
  examinationFindings: string,
  signal?: AbortSignal
): Promise<string> => {
  if (!chiefComplaint && !examinationFindings) {
    throw new AppError(
      'Missing required fields',
      'VALIDATION_ERROR',
      'Please provide chief complaint or examination findings.',
      400
    );
  }

  return makeAIRequest(
    '/api/clinical/ai-diagnosis',
    { chiefComplaint, examinationFindings },
    signal
  );
};

/**
 * Gets AI ICD-10 code suggestions based on diagnosis
 */
export const getICD10Suggestion = async (
  diagnosis: string,
  chiefComplaint: string,
  signal?: AbortSignal
): Promise<string> => {
  if (!diagnosis && !chiefComplaint) {
    throw new AppError(
      'Missing required fields',
      'VALIDATION_ERROR',
      'Please provide a diagnosis or chief complaint.',
      400
    );
  }

  return makeAIRequest(
    '/api/clinical/ai-icd10',
    { diagnosis, chiefComplaint },
    signal
  );
};

/**
 * Gets AI treatment plan suggestions
 */
export const getTreatmentPlanSuggestion = async (
  diagnosis: string,
  examinationFindings: string,
  signal?: AbortSignal
): Promise<string> => {
  if (!diagnosis && !examinationFindings) {
    throw new AppError(
      'Missing required fields',
      'VALIDATION_ERROR',
      'Please provide a diagnosis or examination findings.',
      400
    );
  }

  return makeAIRequest(
    '/api/clinical/ai-treatment',
    { diagnosis, examinationFindings },
    signal
  );
};

/**
 * Gets AI medication recommendations
 */
export const getMedicationSuggestion = async (
  diagnosis: string,
  chiefComplaint: string,
  allergies: string,
  signal?: AbortSignal
): Promise<string> => {
  if (!diagnosis && !chiefComplaint) {
    throw new AppError(
      'Missing required fields',
      'VALIDATION_ERROR',
      'Please provide a diagnosis or chief complaint.',
      400
    );
  }

  return makeAIRequest(
    '/api/clinical/ai-medications',
    { diagnosis, chiefComplaint, allergies: allergies || '' },
    signal
  );
};
