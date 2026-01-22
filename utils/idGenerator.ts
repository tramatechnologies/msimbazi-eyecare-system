/**
 * Secure ID generation utilities
 * Uses crypto.randomUUID() when available, falls back to crypto.getRandomValues() for compatibility
 */

/**
 * Generates a UUID-like string using crypto.getRandomValues as fallback
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const generateUUID = (): string => {
  // Try to use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID().toUpperCase();
    } catch (e) {
      // Fall through to fallback implementation
    }
  }

  // Fallback: Generate UUID v4 using crypto.getRandomValues
  const getRandomValues = (array: Uint8Array) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(array);
    }
    // Last resort: Math.random (less secure, but works everywhere)
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };

  const bytes = new Uint8Array(16);
  getRandomValues(bytes);

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  // Convert to hex string
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

/**
 * Generates a sequential patient ID
 * Format: P001, P002, P003, etc.
 * Finds the highest existing patient number and increments by 1
 * This function does NOT use crypto.randomUUID - it uses simple sequential numbering
 */
export const generatePatientId = (existingPatients?: Array<{ id: string }>): string => {
  try {
    let nextNumber = 1;

    if (existingPatients && Array.isArray(existingPatients) && existingPatients.length > 0) {
      // Extract numbers from existing patient IDs
      const numbers = existingPatients
        .map(patient => {
          if (!patient || !patient.id) return 0;
          // Match patterns like P001, P002, P1, P123, etc.
          const match = String(patient.id).match(/^P0*(\d+)$/i);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => num > 0 && !isNaN(num));

      if (numbers.length > 0) {
        // Find the highest number and increment
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    // Format with leading zeros (P001, P002, ..., P999, P1000, etc.)
    // Use at least 3 digits for readability
    const paddedNumber = nextNumber.toString().padStart(3, '0');
    return `P${paddedNumber}`;
  } catch (error) {
    // Fallback: use timestamp-based ID if something goes wrong
    console.error('Error generating sequential patient ID, using fallback:', error);
    const timestamp = Date.now();
    return `P${timestamp.toString().slice(-6)}`;
  }
};

/**
 * Generates a unique bill item ID
 * Uses UUID for guaranteed uniqueness
 */
export const generateBillItemId = (): string => {
  return `BILL-${Date.now()}-${generateUUID()}`;
};

/**
 * Generates a unique authorization number
 * Format: AUTH-{6-digit-random}
 */
export const generateAuthNumber = (): string => {
  // Use crypto.getRandomValues for secure random number generation
  let randomNum: number;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    randomNum = 100000 + (array[0] % 900000);
  } else {
    // Fallback to Math.random
    randomNum = 100000 + Math.floor(Math.random() * 900000);
  }
  return `AUTH-${randomNum}`;
};

/**
 * Generates a unique ID for any entity
 * Uses UUID for guaranteed uniqueness
 */
export const generateId = (prefix: string = 'ID'): string => {
  return `${prefix}-${Date.now()}-${generateUUID()}`;
};
