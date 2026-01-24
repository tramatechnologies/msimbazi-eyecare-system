
/**
 * Date and Time Utility Functions
 * Provides automatic date/time generation and formatting across the system
 */

/**
 * Gets current date in YYYY-MM-DD format (for date inputs)
 */
export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Gets current time in HH:MM format (for time inputs)
 */
export const getCurrentTime = (): string => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Gets next available appointment time (rounds to nearest 15 minutes, adds 30 min buffer)
 */
export const getNextAvailableTime = (): string => {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  const currentHours = now.getHours();
  
  // Round up to nearest 15 minutes
  let nextMinutes = Math.ceil(currentMinutes / 15) * 15;
  let nextHours = currentHours;
  
  if (nextMinutes >= 60) {
    nextMinutes = 0;
    nextHours += 1;
  }
  
  // Add 30 minute buffer from current time
  nextMinutes += 30;
  if (nextMinutes >= 60) {
    nextMinutes -= 60;
    nextHours += 1;
  }
  
  // Ensure within business hours (8 AM - 6 PM)
  if (nextHours < 8) {
    nextHours = 8;
    nextMinutes = 0;
  } else if (nextHours >= 18) {
    nextHours = 18;
    nextMinutes = 0;
  }
  
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

/**
 * Formats date for display (e.g., "15 Jan 2025")
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Formats time for display (e.g., "09:30 AM")
 * Accepts both time strings (HH:MM) and ISO datetime strings
 */
export const formatTime = (timeString: string): string => {
  if (!timeString) return '';
  
  let hours: number, minutes: string;
  
  // Check if it's an ISO datetime string
  if (timeString.includes('T') || timeString.includes(' ')) {
    const date = new Date(timeString);
    hours = date.getHours();
    minutes = String(date.getMinutes()).padStart(2, '0');
  } else {
    // Assume it's a time string (HH:MM)
    const [h, m] = timeString.split(':');
    hours = parseInt(h);
    minutes = m || '00';
  }
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Formats date and time together (e.g., "15 Jan 2025, 09:30 AM")
 */
export const formatDateTime = (dateString: string, timeString: string): string => {
  const date = formatDate(dateString);
  const time = formatTime(timeString);
  return `${date}, ${time}`;
};

/**
 * Gets current date/time as ISO string (for storing in database)
 */
export const getCurrentDateTimeISO = (): string => {
  return new Date().toISOString();
};

/**
 * Formats ISO date string for display
 */
export const formatISODate = (isoString: string): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return formatDate(date.toISOString().split('T')[0]);
};

/**
 * Formats ISO datetime string for display
 */
export const formatISODateTime = (isoString: string): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].substring(0, 5);
  return formatDateTime(dateStr, timeStr);
};
