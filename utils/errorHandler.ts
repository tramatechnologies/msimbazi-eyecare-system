/**
 * Error handling utilities
 * Centralizes error management and user feedback
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(
      message,
      'VALIDATION_ERROR',
      field ? `${field}: ${message}` : message,
      400
    );
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network request failed') {
    super(
      message,
      'NETWORK_ERROR',
      'Unable to connect to server. Please check your internet connection.',
      0
    );
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(
      message,
      'AUTH_ERROR',
      'Invalid credentials. Please try again.',
      401
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Handles errors and provides user-friendly messages
 */
export const handleError = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.userMessage;
  }
  
  if (error instanceof Error) {
    // Log error for debugging (in production, send to error tracking service)
    console.error('Application error:', error);
    
    // Return user-friendly message
    return 'An unexpected error occurred. Please try again.';
  }
  
  return 'An unknown error occurred. Please try again.';
};

/**
 * Retry function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i < maxRetries - 1) {
        // Exponential backoff
        const waitTime = delay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
};

/**
 * Safe async wrapper that catches errors
 */
export const safeAsync = async <T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.error('Safe async error:', error);
    return fallback;
  }
};
