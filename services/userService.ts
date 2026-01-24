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

// Create singleton admin client to avoid multiple GoTrueClient instances
let adminClientInstance: ReturnType<typeof createClient> | null = null;

// Create admin client for user management operations (singleton pattern)
const getAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin credentials. User management requires service role key.');
  }
  
  // Return existing instance if already created
  if (adminClientInstance) {
    return adminClientInstance;
  }
  
  // Create new instance only if it doesn't exist
  adminClientInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storage: typeof window !== 'undefined' ? undefined : undefined, // No storage for admin client
    }
  });
  
  return adminClientInstance;
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
        role: userData.role,
      },
    });

    // If doctor role, ensure providers row exists (for Assign Doctor dropdown)
    const doctorRoles = [UserRole.OPTOMETRIST, 'OPHTHALMOLOGIST' as UserRole];
    if (doctorRoles.includes(userData.role)) {
      try {
        await adminClient.from('providers').upsert(
          {
            user_id: authData.user.id,
            name: userData.name.trim(),
            role: userData.role,
            status: 'AVAILABLE',
            is_nhif_verified: false,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } catch (provErr) {
        console.error('Failed to sync provider for new doctor:', provErr);
        // Don't fail user creation
      }
    }

    // Log user creation in audit logs
    try {
      const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
      const currentUserId = currentUser.id || 'system';
      await adminClient.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'CREATE_USER',
        entity_type: 'USER',
        entity_id: authData.user.id,
        metadata: {
          newUserEmail: userData.email,
          newUserName: userData.name,
          newUserRole: userData.role,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Error logging user creation:', logError);
      // Don't fail user creation if logging fails
    }

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

const DOCTOR_ROLES = [UserRole.OPTOMETRIST, 'OPHTHALMOLOGIST'];
const isDoctorRole = (r: string) =>
  ['optometrist', 'ophthalmologist'].includes(String(r || '').toLowerCase());

/**
 * Update user role
 */
export const updateUserRole = async (userId: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
  try {
    const adminClient = getAdminClient();

    const { data: existingRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    const previousRole = (existingRole?.role as string) || '';

    const { data: targetUser } = await adminClient.auth.admin.getUserById(userId);
    const name = targetUser?.user?.user_metadata?.name || targetUser?.user?.email?.split('@')[0] || 'Unknown';

    const dbRole = role === UserRole.ADMIN ? 'super_admin' : role.toLowerCase();

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

    const isDoctor = DOCTOR_ROLES.includes(role as any) || isDoctorRole(role);
    const wasDoctor = isDoctorRole(previousRole);
    try {
      if (isDoctor) {
        await adminClient.from('providers').upsert(
          {
            user_id: userId,
            name,
            role: role === UserRole.OPTOMETRIST ? 'OPTOMETRIST' : (role as string),
            status: 'AVAILABLE',
            is_nhif_verified: false,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } else if (wasDoctor) {
        await adminClient.from('providers').delete().eq('user_id', userId);
      }
    } catch (syncErr) {
      console.error('Provider sync on role update:', syncErr);
    }

    try {
      const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
      const currentUserId = currentUser.id || 'system';
      await adminClient.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'UPDATE_USER_ROLE',
        entity_type: 'USER',
        entity_id: userId,
        metadata: {
          targetUserEmail: targetUser?.user?.email,
          newRole: role,
          previousRole,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Error logging role update:', logError);
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

    await adminClient.from('providers').delete().eq('user_id', userId);
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Get user info before deletion for logging
    let userEmail = 'Unknown';
    try {
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      userEmail = userData?.user?.email || 'Unknown';
    } catch {
      // Continue with deletion even if we can't get user info
    }

    // Delete from auth
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to delete user',
      };
    }

    // Log user deletion in audit logs
    try {
      const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
      const currentUserId = currentUser.id || 'system';
      await adminClient.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'DELETE_USER',
        entity_type: 'USER',
        entity_id: userId,
        metadata: {
          deletedUserEmail: userEmail,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Error logging user deletion:', logError);
      // Don't fail deletion if logging fails
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
 * Backfill providers from users with doctor roles (optometrist, ophthalmologist).
 * Call when Assign Doctor dropdown is empty but doctors exist in User Management.
 * Uses service role; safe to call from Registration when no doctors found.
 */
export const syncProvidersFromUsers = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const adminClient = getAdminClient();
    const { success, users, error } = await getAllUsers();
    if (!success || !users) {
      return { success: false, error: error || 'Could not load users' };
    }
    const doctors = users.filter((u) => isDoctorRole(u.role));
    if (doctors.length === 0) return { success: true };

    const { data: existing } = await adminClient
      .from('providers')
      .select('user_id');
    const existingIds = new Set((existing || []).map((r: { user_id: string }) => r.user_id));

    const roleMap: Record<string, string> = {
      optometrist: 'OPTOMETRIST',
      ophthalmologist: 'OPHTHALMOLOGIST',
    };
    for (const u of doctors) {
      if (existingIds.has(u.id)) continue;
      const role = roleMap[String(u.role).toLowerCase()] || 'OPTOMETRIST';
      const { error: ins } = await adminClient.from('providers').insert({
        user_id: u.id,
        name: u.name || u.email?.split('@')[0] || 'Unknown',
        role,
        status: 'AVAILABLE',
        is_nhif_verified: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (ins) {
        console.warn('syncProvidersFromUsers: insert failed for', u.id, ins);
        continue;
      }
      existingIds.add(u.id);
    }
    return { success: true };
  } catch (e: any) {
    console.error('syncProvidersFromUsers:', e);
    return { success: false, error: e?.message || 'Sync failed' };
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
