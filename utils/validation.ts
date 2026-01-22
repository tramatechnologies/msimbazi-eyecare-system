/**
 * Input validation and sanitization utilities
 * Prevents XSS, injection attacks, and data corruption
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Sanitizes string input to prevent XSS attacks
 * Preserves spaces for natural typing
 */
export const sanitizeInput = (input: string, preserveSpaces: boolean = false): string => {
  if (typeof input !== 'string') return '';
  
  let sanitized = input;
  
  // Only trim if not preserving spaces (for final validation)
  if (!preserveSpaces) {
    sanitized = sanitized.trim();
  }
  
  return sanitized
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

/**
 * Validates Kenyan phone number format
 * Format: 07XXXXXXXX (10 digits starting with 07)
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  const sanitized = sanitizeInput(phone);
  return /^07\d{8}$/.test(sanitized);
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): boolean => {
  if (!email) return false;
  const sanitized = sanitizeInput(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized);
};

/**
 * Validates date string (YYYY-MM-DD format)
 */
export const validateDate = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Validates date of birth (must be in the past and reasonable)
 */
export const validateDateOfBirth = (dob: string): boolean => {
  if (!validateDate(dob)) return false;
  
  const birthDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  
  // Age must be between 0 and 150 years
  return age >= 0 && age <= 150;
};

/**
 * Validates patient name (minimum 2 characters, alphanumeric + spaces)
 */
export const validateName = (name: string): boolean => {
  if (!name) return false;
  const sanitized = sanitizeInput(name);
  return sanitized.length >= 2 && sanitized.length <= 100;
};

/**
 * Validates prescription format (e.g., "-2.00 DS", "+1.50")
 */
export const validatePrescription = (prescription: string): boolean => {
  if (!prescription) return true; // Optional field
  const sanitized = sanitizeInput(prescription);
  // Matches formats like: -2.00 DS, +1.50, 0.00, etc.
  return /^[+-]?\d+\.?\d*\s*(DS|DC|SPH|CYL|AXIS)?$/i.test(sanitized);
};

/**
 * Validates insurance number format
 */
export const validateInsuranceNumber = (number: string, type: string): boolean => {
  if (!number) return false;
  const sanitized = sanitizeInput(number);
  
  if (type === 'NHIF') {
    // NHIF format: NH-XXXXXXXXX or similar
    return sanitized.length >= 5 && sanitized.length <= 20;
  }
  
  // Generic insurance number validation
  return sanitized.length >= 5 && sanitized.length <= 30;
};

/**
 * Comprehensive patient validation
 */
export const validatePatient = (patient: Partial<import('../types').Patient>): ValidationResult => {
  const errors: string[] = [];
  
  if (!patient.name || !validateName(patient.name)) {
    errors.push('Name must be between 2 and 100 characters');
  }
  
  if (!patient.phone || !validatePhone(patient.phone)) {
    errors.push('Phone number must be in format 07XXXXXXXX (10 digits)');
  }
  
  if (patient.email && !validateEmail(patient.email)) {
    errors.push('Invalid email format');
  }
  
  if (!patient.dob || !validateDateOfBirth(patient.dob)) {
    errors.push('Invalid date of birth');
  }
  
  if (!patient.gender || !['Male', 'Female', 'Other'].includes(patient.gender)) {
    errors.push('Gender must be Male, Female, or Other');
  }
  
  if (patient.insuranceNumber && patient.insuranceType) {
    if (!validateInsuranceNumber(patient.insuranceNumber, patient.insuranceType)) {
      errors.push('Invalid insurance number format');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates bill item
 */
export const validateBillItem = (item: Partial<import('../types').BillItem>): ValidationResult => {
  const errors: string[] = [];
  
  if (!item.description || sanitizeInput(item.description).length < 3) {
    errors.push('Bill item description must be at least 3 characters');
  }
  
  if (typeof item.amount !== 'number' || item.amount < 0) {
    errors.push('Amount must be a positive number');
  }
  
  if (!item.category || !['CLINICAL', 'PHARMACY', 'OPTICAL'].includes(item.category)) {
    errors.push('Invalid bill item category');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
