/**
 * User Service
 * Handles user management operations with Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { UserRole } from '../types';

// We need service role key for admin operations
// NOTE: In production, this should be done via a secure backend API to protect the service role key
// For now, we're using it in the frontend for admin operations
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Create admin client for user management operations
const getAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin credentials. User management requires service role key.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  created_at?: string;
  last_sign_in_at?: string;
}

/**
 * Create a new user in Supabase Auth and assign role
 */
export const createUser = async (userData: CreateUserData): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const adminClient = getAdminClient();

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: userData.name,
      },
    });

    if (authError) {
      return {
        success: false,
        error: authError.message || 'Failed to create user',
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'User creation failed',
      };
    }

    // Map UserRole enum to database role format (app_role enum)
    // The database uses 'super_admin' for admin role
    const dbRole = userData.role === UserRole.ADMIN ? 'super_admin' : userData.role.toLowerCase();

    // Assign role in user_roles table
    // Note: The role column is of type app_role enum, so we need to ensure the value matches
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: dbRole, // This will be cast to app_role enum by Supabase
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (roleError) {
      // If role assignment fails, try to delete the user
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return {
        success: false,
        error: `Failed to assign role: ${roleError.message}`,
      };
    }

    // Store user name in a user_profiles table if it exists, or in user_metadata
    // For now, we'll update the user metadata
    await adminClient.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        name: userData.name,
      },
    });

    return {
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email || userData.email,
        name: userData.name,
        role: dbRole,
        created_at: authData.user.created_at,
      },
    };
  } catch (error: any) {
    console.error('Error creating user:', error);
    return {
      success: false,
      error: error.message || 'Failed to create user',
    };
  }
};

/**
 * Get all users with their roles
 */
export const getAllUsers = async (): Promise<{ success: boolean; users?: User[]; error?: string }> => {
  try {
    const adminClient = getAdminClient();

    // Get all users from auth
    const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers();

    if (authError) {
      return {
        success: false,
        error: authError.message || 'Failed to fetch users',
      };
    }

    // Get all roles from user_roles table
    const { data: userRoles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('user_id, role, created_at');

    if (rolesError) {
      return {
        success: false,
        error: rolesError.message || 'Failed to fetch user roles',
      };
    }

    // Combine user data with roles
    const users: User[] = authUsers.map(authUser => {
      const userRole = userRoles?.find(ur => ur.user_id === authUser.id);
      return {
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
        role: userRole?.role || 'unknown',
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
      };
    });

    return {
      success: true,
      users,
    };
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch users',
    };
  }
};

/**
 * Update user role
 */
export const updateUserRole = async (userId: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
  try {
    const adminClient = getAdminClient();

    // Map UserRole enum to database role format (app_role enum)
    const dbRole = role === UserRole.ADMIN ? 'super_admin' : role.toLowerCase();

    // Use RPC or direct SQL to properly cast to app_role enum
    // For now, we'll try direct update - Supabase should handle the enum casting
    const { error } = await adminClient
      .from('user_roles')
      .update({
        role: dbRole,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to update user role',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user role:', error);
    return {
      success: false,
      error: error.message || 'Failed to update user role',
    };
  }
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const adminClient = getAdminClient();

    // Delete from user_roles first
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Delete from auth
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to delete user',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete user',
    };
  }
};

/**
 * Reset user password
 */
export const resetUserPassword = async (userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const adminClient = getAdminClient();

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to reset password',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return {
      success: false,
      error: error.message || 'Failed to reset password',
    };
  }
};
