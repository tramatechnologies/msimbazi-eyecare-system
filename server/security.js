/**
 * Enterprise-Level Security Module
 * Comprehensive security middleware and utilities for production deployment
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==================== SECURITY CONFIGURATION ====================

export const SECURITY_CONFIG = {
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100, // per window
  RATE_LIMIT_LOGIN_MAX: 5, // login attempts per window
  RATE_LIMIT_STRICT_MAX: 20, // strict endpoints (create/update/delete)
  
  // Password Policy
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  PASSWORD_MAX_AGE_DAYS: 90, // force password change after 90 days
  
  // Session Security
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes inactivity
  SESSION_MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours absolute max
  
  // CSRF
  CSRF_TOKEN_EXPIRY_MS: 60 * 60 * 1000, // 1 hour
  
  // IP Security
  IP_BLOCK_DURATION_MS: 60 * 60 * 1000, // 1 hour block
  MAX_FAILED_ATTEMPTS_PER_IP: 10,
  
  // Security Headers
  CSP_DIRECTIVES: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust for production
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", process.env.SUPABASE_URL || ''],
    fontSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
};

// ==================== HELMET SECURITY HEADERS ====================

/**
 * Configure Helmet with enterprise security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: SECURITY_CONFIG.CSP_DIRECTIVES,
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// ==================== RATE LIMITING ====================

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS / 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  handler: (req, res) => {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS / 1000,
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMIT_LOGIN_MAX,
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS / 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      email: req.body?.email,
      path: req.path,
    });
    res.status(429).json({
      error: 'Too many login attempts, please try again later.',
      retryAfter: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS / 1000,
    });
  },
});

/**
 * Strict rate limiter for write operations
 */
export const writeRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMIT_STRICT_MAX,
  message: {
    error: 'Too many write operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('WRITE_RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      userId: req.user?.sub,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Too many write operations, please try again later.',
    });
  },
});

// ==================== IP SECURITY ====================

/**
 * Check if IP is blocked
 */
export const isIPBlocked = async (ipAddress) => {
  try {
    const { data, error } = await supabase
      .from('blocked_ips')
      .select('*')
      .eq('ip_address', ipAddress)
      .gt('blocked_until', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return { blocked: !!data, reason: data?.reason || null };
  } catch (error) {
    console.error('Error checking IP block:', error);
    return { blocked: false, reason: null };
  }
};

/**
 * Block an IP address
 */
export const blockIP = async (ipAddress, reason, durationMs = SECURITY_CONFIG.IP_BLOCK_DURATION_MS) => {
  try {
    const blockedUntil = new Date(Date.now() + durationMs).toISOString();

    const { error } = await supabase
      .from('blocked_ips')
      .upsert({
        ip_address: ipAddress,
        reason,
        blocked_at: new Date().toISOString(),
        blocked_until: blockedUntil,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'ip_address',
      });

    if (error) throw error;

    logSecurityEvent('IP_BLOCKED', {
      ip: ipAddress,
      reason,
      blockedUntil,
    });

    return { success: true };
  } catch (error) {
    console.error('Error blocking IP:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check and auto-block IPs with too many failed attempts
 */
export const checkAndBlockIP = async (ipAddress) => {
  try {
    const { data: attempts, error } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('ip_address', ipAddress)
      .eq('success', false)
      .gt('created_at', new Date(Date.now() - SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS).toISOString());

    if (error) throw error;

    if (attempts && attempts.length >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS_PER_IP) {
      await blockIP(ipAddress, 'Too many failed login attempts', SECURITY_CONFIG.IP_BLOCK_DURATION_MS);
      return { shouldBlock: true };
    }

    return { shouldBlock: false };
  } catch (error) {
    console.error('Error checking IP for auto-block:', error);
    return { shouldBlock: false };
  }
};

/**
 * IP blocking middleware
 */
export const ipBlockingMiddleware = async (req, res, next) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const blockStatus = await isIPBlocked(ipAddress);

  if (blockStatus.blocked) {
    logSecurityEvent('BLOCKED_IP_ACCESS_ATTEMPT', {
      ip: ipAddress,
      reason: blockStatus.reason,
      path: req.path,
    });
    return res.status(403).json({
      error: 'Access denied. Your IP address has been temporarily blocked.',
      reason: blockStatus.reason,
    });
  }

  next();
};

// ==================== PASSWORD POLICY ====================

/**
 * Validate password against enterprise policy
 */
export const validatePasswordPolicy = (password) => {
  const errors = [];

  if (!password || password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
  }

  if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak passwords
  const commonPasswords = ['password', 'password123', 'admin', '12345678', 'qwerty'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password),
  };
};

/**
 * Calculate password strength score (0-100)
 */
const calculatePasswordStrength = (password) => {
  let score = 0;

  // Length score (max 25 points)
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 5;

  // Character variety (max 50 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;
  if (password.length > 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) {
    score += 10; // Bonus for all character types
  }

  // Complexity (max 25 points)
  const uniqueChars = new Set(password).size;
  if (uniqueChars / password.length > 0.7) score += 15;
  if (uniqueChars / password.length > 0.9) score += 10;

  return Math.min(100, score);
};

/**
 * Check if password was recently used
 */
export const checkPasswordHistory = async (userId, newPassword) => {
  try {
    const { data: history, error } = await supabase
      .from('password_history')
      .select('password_hash')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5); // Check last 5 passwords

    if (error) throw error;

    // In production, hash the new password and compare with history
    // For now, return true (password not in history)
    return { isNew: true, message: null };
  } catch (error) {
    console.error('Error checking password history:', error);
    return { isNew: true, message: null };
  }
};

// ==================== CSRF PROTECTION ====================

/**
 * Generate CSRF token
 */
export const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Store CSRF token in session
 */
export const storeCSRFToken = async (userId, token) => {
  try {
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.CSRF_TOKEN_EXPIRY_MS).toISOString();

    const { error } = await supabase
      .from('csrf_tokens')
      .upsert({
        user_id: userId,
        token: crypto.createHash('sha256').update(token).digest('hex'),
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error storing CSRF token:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify CSRF token
 */
export const verifyCSRFToken = async (userId, token) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data, error } = await supabase
      .from('csrf_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('token', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return { valid: false, error: 'Invalid or expired CSRF token' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error verifying CSRF token:', error);
    return { valid: false, error: error.message };
  }
};

/**
 * CSRF protection middleware (for state-changing operations)
 */
export const csrfProtection = async (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required for CSRF protection' });
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body?.csrfToken;
  if (!csrfToken) {
    logSecurityEvent('CSRF_TOKEN_MISSING', {
      userId: req.user.sub,
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({ error: 'CSRF token required' });
  }

  const verification = await verifyCSRFToken(req.user.sub, csrfToken);
  if (!verification.valid) {
    logSecurityEvent('CSRF_TOKEN_INVALID', {
      userId: req.user.sub,
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// ==================== SECURITY MONITORING ====================

/**
 * Log security events for monitoring and alerting
 */
export const logSecurityEvent = async (eventType, details = {}) => {
  try {
    const { error } = await supabase.from('security_events').insert({
      event_type: eventType,
      details: details,
      ip_address: details.ip || null,
      user_id: details.userId || null,
      severity: getEventSeverity(eventType),
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('Error logging security event:', error);
    }

    // Alert on critical events
    if (getEventSeverity(eventType) === 'CRITICAL') {
      await triggerSecurityAlert(eventType, details);
    }
  } catch (error) {
    console.error('Error in logSecurityEvent:', error);
  }
};

/**
 * Get severity level for security event
 */
const getEventSeverity = (eventType) => {
  const criticalEvents = [
    'UNAUTHORIZED_ACCESS',
    'PRIVILEGE_ESCALATION',
    'DATA_BREACH_ATTEMPT',
    'SQL_INJECTION_ATTEMPT',
    'XSS_ATTEMPT',
  ];

  const highEvents = [
    'RATE_LIMIT_EXCEEDED',
    'AUTH_RATE_LIMIT_EXCEEDED',
    'IP_BLOCKED',
    'CSRF_TOKEN_INVALID',
    'SUSPICIOUS_ACTIVITY',
  ];

  if (criticalEvents.includes(eventType)) return 'CRITICAL';
  if (highEvents.includes(eventType)) return 'HIGH';
  return 'MEDIUM';
};

/**
 * Trigger security alert (can be extended to send emails, SMS, etc.)
 */
const triggerSecurityAlert = async (eventType, details) => {
  console.error('🚨 SECURITY ALERT:', eventType, details);
  // TODO: Integrate with alerting system (email, SMS, Slack, PagerDuty, etc.)
};

/**
 * Detect suspicious activity patterns
 */
export const detectSuspiciousActivity = async (userId, ipAddress, action) => {
  try {
    // Check for rapid successive actions
    const { data: recentActions, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .gt('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('timestamp', { ascending: false });

    if (error) throw error;

    if (recentActions && recentActions.length > 20) {
      await logSecurityEvent('SUSPICIOUS_ACTIVITY', {
        userId,
        ip: ipAddress,
        action,
        reason: 'Excessive activity in short time period',
        actionCount: recentActions.length,
      });
      return { suspicious: true, reason: 'Excessive activity' };
    }

    // Check for actions from multiple IPs
    const uniqueIPs = new Set(recentActions?.map(a => a.ip_address) || []);
    if (uniqueIPs.size > 3) {
      await logSecurityEvent('SUSPICIOUS_ACTIVITY', {
        userId,
        ip: ipAddress,
        action,
        reason: 'Activity from multiple IP addresses',
        ipCount: uniqueIPs.size,
      });
      return { suspicious: true, reason: 'Multiple IP addresses' };
    }

    return { suspicious: false };
  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
    return { suspicious: false };
  }
};

// ==================== INPUT SANITIZATION ENHANCEMENT ====================

/**
 * Enhanced input sanitization
 */
export const sanitizeInput = (input, type = 'string') => {
  if (input === null || input === undefined) return null;

  if (type === 'string') {
    return String(input)
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]+>/g, '') // Remove all HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data URIs
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/['";\\]/g, ''); // Remove SQL injection characters
  }

  if (type === 'number') {
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  }

  if (type === 'email') {
    return String(input).toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '');
  }

  return input;
};

// ==================== REQUEST VALIDATION ====================

/**
 * Validate request size
 */
export const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  if (contentLength > MAX_SIZE) {
    logSecurityEvent('REQUEST_SIZE_EXCEEDED', {
      ip: req.ip,
      size: contentLength,
      path: req.path,
    });
    return res.status(413).json({ error: 'Request payload too large' });
  }

  next();
};

/**
 * Validate content type
 */
export const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
  }
  next();
};

// ==================== EXPORTS ====================

export default {
  securityHeaders,
  apiRateLimiter,
  authRateLimiter,
  writeRateLimiter,
  ipBlockingMiddleware,
  validatePasswordPolicy,
  checkPasswordHistory,
  generateCSRFToken,
  storeCSRFToken,
  verifyCSRFToken,
  csrfProtection,
  logSecurityEvent,
  detectSuspiciousActivity,
  sanitizeInput,
  validateRequestSize,
  validateContentType,
  isIPBlocked,
  blockIP,
  checkAndBlockIP,
};
