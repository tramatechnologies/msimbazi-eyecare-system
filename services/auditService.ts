/**
 * Audit Service
 * Handles fetching audit logs from the backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  ip_address?: string;
  status?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  created_at: string;
}

export interface AuditLogFilters {
  action?: string;
  user?: string;
  dateRange?: string;
  entityType?: string;
}

const getAuthHeader = () => {
  const token = sessionStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Fetch audit logs from the backend
 */
export const getAuditLogs = async (filters: AuditLogFilters = {}): Promise<AuditLog[]> => {
  try {
    const queryParams = new URLSearchParams();
    if (filters.action && filters.action !== 'all') {
      queryParams.append('action', filters.action);
    }
    if (filters.user && filters.user !== 'all') {
      queryParams.append('user', filters.user);
    }
    if (filters.dateRange) {
      queryParams.append('dateRange', filters.dateRange);
    }
    if (filters.entityType) {
      queryParams.append('entityType', filters.entityType);
    }

    const response = await fetch(`${API_BASE_URL}/api/audit-logs?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.logs || [];
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
};

/**
 * Get list of unique users who have performed actions (for filter dropdown)
 */
export const getAuditLogUsers = async (): Promise<Array<{ id: string; name: string; email: string }>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/audit-logs/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audit log users: ${response.statusText}`);
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error('Error fetching audit log users:', error);
    return [];
  }
};
