/**
 * Authentication Module
 * Handles user authentication, JWT token generation, and session management
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const JWT_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Validate login attempt rate limiting
 */
export const checkLoginAttempts = async (email, ipAddress) => {
  try {
    // Check recent failed attempts
    const { data: attempts, error } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('success', false)
      .gt('created_at', new Date(Date.now() - LOCKOUT_DURATION).toISOString())
      .order('created_at', { ascending: false })
      .limit(MAX_LOGIN_ATTEMPTS);

    if (error) throw error;

    if (attempts && attempts.length >= MAX_LOGIN_ATTEMPTS) {
      return {
        allowed: false,
        message: `Too many failed login attempts. Please try again after 15 minutes.`,
        lockedUntil: new Date(attempts[0].created_at).getTime() + LOCKOUT_DURATION,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking login attempts:', error);
    return { allowed: true }; // Allow on error (fail secure)
  }
};

/**
 * Record login attempt
 */
export const recordLoginAttempt = async (email, ipAddress, userAgent, success) => {
  try {
    const { error } = await supabase.from('login_attempts').insert({
      email: email.toLowerCase(),
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error recording login attempt:', error);
  }
};

/**
 * Validate user credentials against Supabase Auth
 */
export const validateCredentials = async (email, password) => {
  try {
    // Use Supabase's built-in authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      return { valid: false, error: error.message };
    }

    if (!data.user) {
      return { valid: false, error: 'Authentication failed' };
    }

    // Get user role from custom claims
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .single();

    if (roleError) {
      return { valid: false, error: 'User role not found' };
    }

    return {
      valid: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: userRole.role,
      },
      session: data.session,
    };
  } catch (error) {
    console.error('Error validating credentials:', error);
    return { valid: false, error: 'Authentication failed' };
  }
};

/**
 * Generate JWT token pair
 */
export const generateTokens = (userId, email, role) => {
  const accessToken = jwt.sign(
    {
      sub: userId,
      email,
      role,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwt.sign(
    {
      sub: userId,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Hash token for secure storage
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Create user session
 */
export const createSession = async (userId, token, ipAddress, userAgent) => {
  try {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt,
      });

    if (error) throw error;

    return { success: true, expiresAt };
  } catch (error) {
    console.error('Error creating session:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Revoke user session
 */
export const revokeSession = async (userId, token) => {
  try {
    const tokenHash = hashToken(token);

    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token_hash', tokenHash);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error revoking session:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify session is still active
 */
export const verifySession = async (userId, token) => {
  try {
    const tokenHash = hashToken(token);

    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      return { valid: false, error: 'Session invalid or expired' };
    }

    return { valid: true, session };
  } catch (error) {
    console.error('Error verifying session:', error);
    return { valid: false, error: error.message };
  }
};

/**
 * Check user role permissions
 */
export const checkPermission = async (userId, requiredPermission) => {
  try {
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError) return { allowed: false, error: 'User role not found' };

    const { data: permissions, error: permError } = await supabase
      .from('role_permissions')
      .select('permissions')
      .eq('role', userRole.role)
      .single();

    if (permError) return { allowed: false, error: 'Permissions not found' };

    // Check if permission is in the user's role permissions
    const userPermissions = permissions.permissions || {};
    const allowed =
      userPermissions[requiredPermission] === true ||
      userPermissions['*'] === true;

    return { allowed, role: userRole.role };
  } catch (error) {
    console.error('Error checking permission:', error);
    return { allowed: false, error: error.message };
  }
};

/**
 * Log authentication action
 */
export const logAuthAction = async (userId, action, ipAddress, status = 'SUCCESS') => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `AUTH_${action}`,
      ip_address: ipAddress,
      status,
      timestamp: new Date().toISOString(),
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error logging auth action:', error);
  }
};
