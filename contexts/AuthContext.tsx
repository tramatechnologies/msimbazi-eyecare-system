/**
 * Authentication Context with Supabase
 * Manages user authentication directly with Supabase Auth
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { UserRole } from '../types';
import { AuthenticationError, handleError } from '../utils/errorHandler';

interface AuthContextType {
  isAuthenticated: boolean;
  activeRole: UserRole | null;
  user: { id: string; email: string; name?: string } | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  changeRole: (role: UserRole) => Promise<{ success: boolean; error?: string }>;
  refreshToken: () => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Initialize Supabase client with error handling
let supabase: ReturnType<typeof createClient> | null = null;

try {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  } else {
    console.warn('Supabase environment variables not found. Authentication will not work.');
    console.warn('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

// Map database roles to TypeScript UserRole enum
const mapDatabaseRoleToUserRole = (dbRole: string): UserRole => {
  // Map super_admin from database to ADMIN enum
  if (dbRole === 'super_admin' || dbRole === 'SUPER_ADMIN') {
    return UserRole.ADMIN;
  }
  // Convert snake_case to UPPER_SNAKE_CASE for enum matching
  const upperRole = dbRole.toUpperCase().replace(/-/g, '_');
  // Check if it matches any UserRole enum value
  if (Object.values(UserRole).includes(upperRole as UserRole)) {
    return upperRole as UserRole;
  }
  // Default to ADMIN if role not found
  console.warn(`Unknown role "${dbRole}", defaulting to ADMIN`);
  return UserRole.ADMIN;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    if (!supabase) {
      console.error('Supabase client not initialized. Cannot restore session.');
      return;
    }

    const restoreSession = async () => {
      try {
        // Check for existing Supabase session
        const { data: { session }, error } = await supabase!.auth.getSession();
        
        if (error) {
          console.error('Error restoring session:', error);
          // Clear any invalid session data
          setIsAuthenticated(false);
          setActiveRole(null);
          setUser(null);
          return;
        }

        // Only restore if we have a valid session with a user
        if (session?.user && session.access_token) {
          // Verify the session is still valid by checking if user exists
          const { data: { user: currentUser }, error: userError } = await supabase!.auth.getUser();
          
          if (userError || !currentUser) {
            // Session is invalid, clear it
            console.warn('Invalid session detected, clearing...');
            await supabase!.auth.signOut();
            setIsAuthenticated(false);
            setActiveRole(null);
            setUser(null);
            return;
          }

          // Get user role from user_roles table
          const { data: userRole, error: roleError } = await supabase!
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();

          if (roleError) {
            console.error('Error fetching user role:', roleError);
            // Don't restore session if role is missing
            setIsAuthenticated(false);
            setActiveRole(null);
            setUser(null);
            return;
          }

          setIsAuthenticated(true);
          setActiveRole(mapDatabaseRoleToUserRole(userRole.role));
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || undefined,
          });
        } else {
          // No valid session, ensure state is cleared
          setIsAuthenticated(false);
          setActiveRole(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
        // On error, clear state
        setIsAuthenticated(false);
        setActiveRole(null);
        setUser(null);
      }
    };

    restoreSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Get user role
        const { data: userRole } = await supabase!
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();

        if (userRole) {
          setIsAuthenticated(true);
          setActiveRole(mapDatabaseRoleToUserRole(userRole.role));
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || undefined,
          });
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setActiveRole(null);
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Update user data on token refresh
        const { data: userRole } = await supabase!
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        if (userRole) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || undefined,
          });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Login with email and password
   * Uses Supabase Auth directly
   */
  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      if (!supabase) {
        return {
          success: false,
          error: 'Supabase client not initialized. Please check your environment variables.',
        };
      }

      // Validate input
      if (!email || !email.trim()) {
        throw new AuthenticationError('Email is required');
      }

      if (!password) {
        throw new AuthenticationError('Password is required');
      }

      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError) {
        return {
          success: false,
          error: authError.message || 'Authentication failed',
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Authentication failed',
        };
      }

      // Get user role from user_roles table
      const { data: userRole, error: roleError } = await supabase!
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .single();

      if (roleError) {
        return {
          success: false,
          error: 'User role not found. Please contact administrator.',
        };
      }

      setIsAuthenticated(true);
      setActiveRole(mapDatabaseRoleToUserRole(userRole.role));
      setUser({
        id: authData.user.id,
        email: authData.user.email || '',
        name: authData.user.user_metadata?.name || undefined,
      });

      return { success: true };
    } catch (err) {
      const errorMessage = handleError(err);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout and revoke session
   */
  const logout = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        // Clear state even if supabase is not initialized
        setIsAuthenticated(false);
        setActiveRole(null);
        setUser(null);
        // Clear any stored session data
        if (typeof window !== 'undefined') {
          // Clear all Supabase-related keys
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token')) {
              localStorage.removeItem(key);
            }
          });
          sessionStorage.clear();
        }
        return { success: true };
      }

      // Sign out from Supabase - this should clear the session from storage
      const { error } = await supabase.auth.signOut();

      // Clear state immediately after signOut
      setIsAuthenticated(false);
      setActiveRole(null);
      setUser(null);

      // Explicitly clear Supabase session storage
      if (typeof window !== 'undefined') {
        // Clear all Supabase-related keys from localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token')) {
            localStorage.removeItem(key);
          }
        });
        sessionStorage.clear();
      }

      if (error) {
        console.error('Logout error:', error);
        // State is already cleared, so we still return success
        return {
          success: true,
          error: error.message,
        };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = handleError(err);
      console.error('Logout exception:', err);
      // Clear state even on error
      setIsAuthenticated(false);
      setActiveRole(null);
      setUser(null);
      // Clear storage on error too
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      return {
        success: true,
        error: errorMessage,
      };
    }
  }, []);

  /**
   * Change role (requires verification from database)
   */
  const changeRole = useCallback(async (role: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return {
          success: false,
          error: 'Supabase client not initialized',
        };
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new AuthenticationError('Not authenticated');
      }

      // Check if user has permission for this role (you can add permission checking here)
      // For now, we'll just update the role if the user is authenticated
      const { error } = await supabase!
        .from('user_roles')
        .update({ role: role })
        .eq('user_id', user.id);

      if (error) {
        return {
          success: false,
          error: error.message || 'Role change failed',
        };
      }

      setActiveRole(role);

      return { success: true };
    } catch (err) {
      const errorMessage = handleError(err);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  /**
   * Refresh access token using Supabase session
   */
  const refreshToken = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return {
          success: false,
          error: 'Supabase client not initialized',
        };
      }

      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        // Refresh failed, logout user
        await logout();
        return {
          success: false,
          error: error.message || 'Token refresh failed',
        };
      }

      if (!session) {
        return {
          success: false,
          error: 'No session available',
        };
      }

      return { success: true };
    } catch (err) {
      console.error('Token refresh error:', err);
      return {
        success: false,
        error: 'Token refresh failed',
      };
    }
  }, [logout]);

  const value: AuthContextType = {
    isAuthenticated,
    activeRole,
    user,
    login,
    logout,
    changeRole,
    refreshToken,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
