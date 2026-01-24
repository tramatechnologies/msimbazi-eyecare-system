/**
 * Audit Log Service
 * Helper service to log critical operations from the frontend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getAuthHeader = () => {
  const token = sessionStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Log a critical operation from the frontend
 */
export const logCriticalOperation = async (
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/audit-logs/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        action,
        entityType,
        entityId,
        metadata,
      }),
    });

    if (!response.ok) {
      console.error('Failed to log operation:', response.statusText);
    }
  } catch (error) {
    console.error('Error logging operation:', error);
    // Don't throw - logging failures shouldn't break the app
  }
};
