/**
 * Input Validation Module
 * Server-side validation for all data entry points
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALIDATION_PATTERNS = {
  phone: /^07\d{8}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  prescription: /^[+-]?\d+\.?\d*\s*(DS|DC|SPH|CYL|AXIS)?$/i,
  insuranceNumber: /^[A-Z0-9\-]+$/,
  nhifNumber: /^[0-9]{10,}$/,
  name: /^[a-zA-Z\s'-]{2,255}$/,
};

/**
 * Validate patient data
 */
export const validatePatient = async (patientData) => {
  const errors = {};

  // Name validation
  if (!patientData.name || patientData.name.trim().length === 0) {
    errors.name = 'Name is required';
  } else if (patientData.name.length < 2 || patientData.name.length > 255) {
    errors.name = 'Name must be between 2 and 255 characters';
  } else if (!VALIDATION_PATTERNS.name.test(patientData.name)) {
    errors.name = 'Name contains invalid characters';
  }

  // Phone validation
  if (!patientData.phone || patientData.phone.trim().length === 0) {
    errors.phone = 'Phone number is required';
  } else if (!VALIDATION_PATTERNS.phone.test(patientData.phone)) {
    errors.phone = 'Phone must be 10 digits starting with 07 (07XXXXXXXX)';
  } else {
    // Check for duplicates
    const { data: existing, error } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', patientData.phone)
      .neq('id', patientData.id || 'null');

    if (error) {
      errors.phone = 'Database error checking phone uniqueness';
    } else if (existing && existing.length > 0) {
      errors.phone = 'A patient with this phone number already exists';
    }
  }

  // Email validation (optional but if provided must be valid)
  if (patientData.email && patientData.email.trim().length > 0) {
    if (!VALIDATION_PATTERNS.email.test(patientData.email)) {
      errors.email = 'Invalid email format';
    }
  }

  // Date of birth validation
  if (!patientData.dob || patientData.dob.trim().length === 0) {
    errors.dob = 'Date of birth is required';
  } else {
    const dob = new Date(patientData.dob);
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear();

    if (isNaN(dob.getTime())) {
      errors.dob = 'Invalid date of birth format';
    } else if (dob > now) {
      errors.dob = 'Date of birth cannot be in the future';
    } else if (age > 150) {
      errors.dob = 'Age cannot exceed 150 years';
    } else if (age < 0) {
      errors.dob = 'Invalid date of birth';
    }
  }

  // Gender validation
  if (!patientData.gender || !['Male', 'Female', 'Other'].includes(patientData.gender)) {
    errors.gender = 'Invalid gender value';
  }

  // Insurance type validation
  if (!patientData.insuranceType || !['NHIF', 'PRIVATE', 'CASH'].includes(patientData.insuranceType)) {
    errors.insuranceType = 'Invalid insurance type';
  }

  // Insurance number validation (required if not CASH)
  if (patientData.insuranceType !== 'CASH') {
    if (!patientData.insuranceNumber || patientData.insuranceNumber.trim().length === 0) {
      errors.insuranceNumber = 'Insurance number is required for this insurance type';
    } else if (patientData.insuranceNumber.length < 3) {
      errors.insuranceNumber = 'Insurance number must be at least 3 characters';
    } else if (!VALIDATION_PATTERNS.insuranceNumber.test(patientData.insuranceNumber)) {
      errors.insuranceNumber = 'Insurance number contains invalid characters';
    }

    // NHIF specific validation
    if (patientData.insuranceType === 'NHIF') {
      if (!patientData.nhifAuthNumber || patientData.nhifAuthNumber.trim().length === 0) {
        errors.nhifAuthNumber = 'NHIF authorization number is required';
      } else if (!VALIDATION_PATTERNS.nhifNumber.test(patientData.nhifAuthNumber)) {
        errors.nhifAuthNumber = 'Invalid NHIF authorization number format';
      }
    }
  }

  // Address validation (optional but limited length)
  if (patientData.address && patientData.address.length > 500) {
    errors.address = 'Address must not exceed 500 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate prescription data
 */
export const validatePrescription = (prescriptionData) => {
  const errors = {};

  // OD validation (optional but if provided must be valid)
  if (prescriptionData.od && prescriptionData.od.trim().length > 0) {
    if (!VALIDATION_PATTERNS.prescription.test(prescriptionData.od)) {
      errors.od = 'Invalid OD prescription format';
    }
  }

  // OS validation (optional but if provided must be valid)
  if (prescriptionData.os && prescriptionData.os.trim().length > 0) {
    if (!VALIDATION_PATTERNS.prescription.test(prescriptionData.os)) {
      errors.os = 'Invalid OS prescription format';
    }
  }

  // Addition validation (optional)
  if (prescriptionData.add && prescriptionData.add.trim().length > 0) {
    if (!VALIDATION_PATTERNS.prescription.test(prescriptionData.add)) {
      errors.add = 'Invalid ADD prescription format';
    }
  }

  // Clinical notes length
  if (prescriptionData.clinicalNotes && prescriptionData.clinicalNotes.length > 2000) {
    errors.clinicalNotes = 'Clinical notes must not exceed 2000 characters';
  }

  // Diagnosis length
  if (prescriptionData.diagnosis && prescriptionData.diagnosis.length > 1000) {
    errors.diagnosis = 'Diagnosis must not exceed 1000 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate bill item data
 */
export const validateBillItem = (billItemData) => {
  const errors = {};

  // Description validation
  if (!billItemData.description || billItemData.description.trim().length === 0) {
    errors.description = 'Description is required';
  } else if (billItemData.description.length > 255) {
    errors.description = 'Description must not exceed 255 characters';
  }

  // Amount validation
  if (!billItemData.amount || isNaN(parseFloat(billItemData.amount))) {
    errors.amount = 'Amount is required and must be a number';
  } else if (parseFloat(billItemData.amount) <= 0) {
    errors.amount = 'Amount must be greater than 0';
  } else if (parseFloat(billItemData.amount) > 1000000) {
    errors.amount = 'Amount is unreasonably high';
  }

  // Category validation
  if (!billItemData.category || !['CLINICAL', 'PHARMACY', 'OPTICAL'].includes(billItemData.category)) {
    errors.category = 'Invalid category';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate appointment data
 */
export const validateAppointment = (appointmentData) => {
  const errors = {};

  // Date validation
  if (!appointmentData.appointmentDate || appointmentData.appointmentDate.trim().length === 0) {
    errors.appointmentDate = 'Appointment date is required';
  } else {
    const appointmentDate = new Date(appointmentData.appointmentDate);
    const now = new Date();

    if (isNaN(appointmentDate.getTime())) {
      errors.appointmentDate = 'Invalid appointment date format';
    } else if (appointmentDate < now) {
      errors.appointmentDate = 'Appointment date cannot be in the past';
    }
  }

  // Time validation
  if (!appointmentData.appointmentTime || appointmentData.appointmentTime.trim().length === 0) {
    errors.appointmentTime = 'Appointment time is required';
  } else {
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(appointmentData.appointmentTime)) {
      errors.appointmentTime = 'Invalid time format (HH:MM)';
    }
  }

  // Type validation
  if (!appointmentData.appointmentType || appointmentData.appointmentType.trim().length === 0) {
    errors.appointmentType = 'Appointment type is required';
  }

  // Chief complaint validation (optional)
  if (appointmentData.chiefComplaint && appointmentData.chiefComplaint.length > 1000) {
    errors.chiefComplaint = 'Chief complaint must not exceed 1000 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Sanitize string input
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove data URIs
    .replace(/data:/gi, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '');
};

/**
 * Sanitize and validate email
 */
export const sanitizeEmail = (email) => {
  const sanitized = sanitizeString(email).toLowerCase();
  return VALIDATION_PATTERNS.email.test(sanitized) ? sanitized : null;
};

/**
 * Sanitize and validate phone
 */
export const sanitizePhone = (phone) => {
  const sanitized = sanitizeString(phone).replace(/\D/g, '');
  return sanitized.length === 10 && sanitized.startsWith('07') ? sanitized : null;
};

/**
 * Get validation rules from database
 */
export const getValidationRules = async (entityType) => {
  try {
    const { data: rules, error } = await supabase
      .from('validation_rules')
      .select('*')
      .eq('entity_type', entityType);

    if (error) throw error;

    return rules || [];
  } catch (error) {
    console.error('Error fetching validation rules:', error);
    return [];
  }
};

/**
 * Apply dynamic validation rules
 */
export const validateWithRules = (entityType, data, rules) => {
  const errors = {};

  rules.forEach((rule) => {
    const fieldValue = data[rule.field_name];

    if (fieldValue === null || fieldValue === undefined) {
      if (rule.rule_type === 'required') {
        errors[rule.field_name] = rule.message || `${rule.field_name} is required`;
      }
      return;
    }

    switch (rule.rule_type) {
      case 'min_length':
        if (String(fieldValue).length < parseInt(rule.rule_value)) {
          errors[rule.field_name] = rule.message;
        }
        break;

      case 'max_length':
        if (String(fieldValue).length > parseInt(rule.rule_value)) {
          errors[rule.field_name] = rule.message;
        }
        break;

      case 'min_value':
        if (parseFloat(fieldValue) < parseFloat(rule.rule_value)) {
          errors[rule.field_name] = rule.message;
        }
        break;

      case 'max_value':
        if (parseFloat(fieldValue) > parseFloat(rule.rule_value)) {
          errors[rule.field_name] = rule.message;
        }
        break;

      case 'pattern':
        const regex = new RegExp(rule.rule_value);
        if (!regex.test(String(fieldValue))) {
          errors[rule.field_name] = rule.message;
        }
        break;

      case 'enum':
        const allowedValues = rule.rule_value.split('|');
        if (!allowedValues.includes(String(fieldValue))) {
          errors[rule.field_name] = rule.message;
        }
        break;

      case 'min_age':
        const dob = new Date(fieldValue);
        const now = new Date();
        const age = now.getFullYear() - dob.getFullYear();
        if (age < parseInt(rule.rule_value)) {
          errors[rule.field_name] = rule.message;
        }
        break;

      case 'max_age':
        const dobMax = new Date(fieldValue);
        const nowMax = new Date();
        const ageMax = nowMax.getFullYear() - dobMax.getFullYear();
        if (ageMax > parseInt(rule.rule_value)) {
          errors[rule.field_name] = rule.message;
        }
        break;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
