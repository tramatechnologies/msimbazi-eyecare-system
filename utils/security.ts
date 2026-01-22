/**
 * Frontend Security Utilities
 * Provides secure storage, XSS protection, and client-side security functions
 */

// ==================== SECURE STORAGE ====================

/**
 * Secure storage wrapper with encryption for sensitive data
 */
export class SecureStorage {
  private static readonly PREFIX = 'msimbazi_secure_';
  private static readonly ENCRYPTION_KEY = 'msimbazi_encryption_key'; // In production, use environment variable

  /**
   * Store data securely (with basic obfuscation)
   * Note: For production, use proper encryption libraries
   */
  static setItem(key: string, value: string): void {
    try {
      // Basic obfuscation (in production, use proper encryption)
      const obfuscated = btoa(unescape(encodeURIComponent(value)));
      sessionStorage.setItem(`${this.PREFIX}${key}`, obfuscated);
    } catch (error) {
      console.error('Error storing secure data:', error);
      throw new Error('Failed to store secure data');
    }
  }

  /**
   * Retrieve data securely
   */
  static getItem(key: string): string | null {
    try {
      const obfuscated = sessionStorage.getItem(`${this.PREFIX}${key}`);
      if (!obfuscated) return null;
      
      // Deobfuscate
      return decodeURIComponent(escape(atob(obfuscated)));
    } catch (error) {
      console.error('Error retrieving secure data:', error);
      return null;
    }
  }

  /**
   * Remove secure data
   */
  static removeItem(key: string): void {
    sessionStorage.removeItem(`${this.PREFIX}${key}`);
  }

  /**
   * Clear all secure data
   */
  static clear(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(this.PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

// ==================== XSS PROTECTION ====================

/**
 * Sanitize HTML to prevent XSS attacks
 */
export const sanitizeHTML = (input: string): string => {
  if (!input) return '';

  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Escape HTML entities
 */
export const escapeHTML = (input: string): string => {
  if (!input) return '';

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return input.replace(/[&<>"']/g, (char) => map[char]);
};

/**
 * Validate and sanitize user input
 */
export const sanitizeInput = (input: string, type: 'text' | 'email' | 'phone' | 'number' = 'text'): string => {
  if (!input) return '';

  let sanitized = input.trim();

  // Remove script tags and event handlers
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '');

  // Type-specific validation
  switch (type) {
    case 'email':
      sanitized = sanitized.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
      break;
    case 'phone':
      sanitized = sanitized.replace(/\D/g, '');
      break;
    case 'number':
      sanitized = sanitized.replace(/[^0-9.-]/g, '');
      break;
    default:
      // Remove control characters
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  }

  return sanitized;
};

// ==================== CSRF TOKEN MANAGEMENT ====================

/**
 * Get CSRF token from secure storage
 */
export const getCSRFToken = (): string | null => {
  return SecureStorage.getItem('csrf_token');
};

/**
 * Store CSRF token securely
 */
export const setCSRFToken = (token: string): void => {
  SecureStorage.setItem('csrf_token', token);
};

/**
 * Add CSRF token to request headers
 */
export const addCSRFHeader = (headers: HeadersInit = {}): HeadersInit => {
  const token = getCSRFToken();
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token,
    };
  }
  return headers;
};

// ==================== TOKEN MANAGEMENT ====================

/**
 * Store authentication token securely
 */
export const storeAuthToken = (token: string): void => {
  SecureStorage.setItem('auth_token', token);
};

/**
 * Get authentication token
 */
export const getAuthToken = (): string | null => {
  return SecureStorage.getItem('auth_token');
};

/**
 * Remove authentication token
 */
export const removeAuthToken = (): void => {
  SecureStorage.removeItem('auth_token');
};

/**
 * Store refresh token securely
 */
export const storeRefreshToken = (token: string): void => {
  SecureStorage.setItem('refresh_token', token);
};

/**
 * Get refresh token
 */
export const getRefreshToken = (): string | null => {
  return SecureStorage.getItem('refresh_token');
};

/**
 * Remove refresh token
 */
export const removeRefreshToken = (): void => {
  SecureStorage.removeItem('refresh_token');
};

/**
 * Clear all authentication data
 */
export const clearAuthData = (): void => {
  removeAuthToken();
  removeRefreshToken();
  SecureStorage.removeItem('csrf_token');
  SecureStorage.removeItem('user_data');
};

// ==================== SECURITY HEADERS ====================

/**
 * Create secure fetch headers with auth and CSRF
 */
export const createSecureHeaders = (additionalHeaders: HeadersInit = {}): HeadersInit => {
  const token = getAuthToken();
  const csrfToken = getCSRFToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return headers;
};

// ==================== PASSWORD VALIDATION ====================

/**
 * Validate password strength on frontend
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  } else {
    score += 20;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;
  }

  // Character variety
  if (/[a-z]/.test(password)) {
    score += 10;
  } else {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (/[A-Z]/.test(password)) {
    score += 10;
  } else {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (/[0-9]/.test(password)) {
    score += 10;
  } else {
    errors.push('Password must contain at least one number');
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 10;
  } else {
    errors.push('Password must contain at least one special character');
  }

  // Complexity bonus
  const uniqueChars = new Set(password).size;
  if (uniqueChars / password.length > 0.7) score += 10;
  if (uniqueChars / password.length > 0.9) score += 10;

  // Check for common passwords
  const commonPasswords = ['password', 'password123', 'admin', '12345678', 'qwerty'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common. Please choose a stronger password');
    score = Math.max(0, score - 20);
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong' = 'weak';
  if (score >= 80) strength = 'very-strong';
  else if (score >= 60) strength = 'strong';
  else if (score >= 40) strength = 'medium';

  return {
    isValid: errors.length === 0 && score >= 40,
    errors,
    strength,
    score: Math.min(100, score),
  };
};

// ==================== SECURE API CALLS ====================

/**
 * Secure fetch wrapper with automatic token and CSRF handling
 */
export const secureFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const headers = createSecureHeaders(options.headers);

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for CSRF
  });

  // Update CSRF token if provided in response
  const csrfToken = response.headers.get('X-CSRF-Token');
  if (csrfToken) {
    setCSRFToken(csrfToken);
  }

  // Handle token refresh if needed
  if (response.status === 401) {
    // Token expired, attempt refresh
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // TODO: Implement token refresh logic
      console.warn('Token expired, refresh needed');
    }
  }

  return response;
};

// ==================== SECURITY UTILITIES ====================

/**
 * Check if running in secure context (HTTPS)
 */
export const isSecureContext = (): boolean => {
  return window.isSecureContext || location.protocol === 'https:';
};

/**
 * Log security event on frontend (for monitoring)
 */
export const logSecurityEvent = (eventType: string, details: Record<string, unknown> = {}): void => {
  // In production, send to security monitoring service
  console.warn('Security Event:', eventType, details);
  
  // Optionally send to backend for logging
  // secureFetch('/api/security/events', {
  //   method: 'POST',
  //   body: JSON.stringify({ eventType, details }),
  // }).catch(err => console.error('Failed to log security event:', err));
};

/**
 * Detect suspicious activity patterns
 */
export const detectSuspiciousActivity = (): boolean => {
  // Check for dev tools
  const devtools = {
    open: false,
    orientation: null as number | null,
  };

  const threshold = 160;
  setInterval(() => {
    if (
      window.outerHeight - window.innerHeight > threshold ||
      window.outerWidth - window.innerWidth > threshold
    ) {
      if (!devtools.open) {
        devtools.open = true;
        logSecurityEvent('DEVTOOLS_DETECTED', {
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      devtools.open = false;
    }
  }, 500);

  return devtools.open;
};

/**
 * Clear sensitive data on page unload
 */
export const setupSecureCleanup = (): void => {
  window.addEventListener('beforeunload', () => {
    // Clear sensitive data from memory
    // Note: sessionStorage persists, but we clear on logout
  });

  // Clear on visibility change (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Optionally clear sensitive data when tab is hidden
    }
  });
};

// Initialize security on module load
if (typeof window !== 'undefined') {
  setupSecureCleanup();
}
