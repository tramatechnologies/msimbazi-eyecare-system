/**
 * Enhanced Backend API Server
 * Implements authentication, authorization, input validation, and RBAC
 * Run with: node server/enhanced-api.js
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  checkLoginAttempts,
  recordLoginAttempt,
  validateCredentials,
  generateTokens,
  verifyToken,
  createSession,
  revokeSession,
  verifySession,
  checkPermission,
  logAuthAction,
} from './auth.js';
import {
  validatePatient,
  validatePrescription,
  validateBillItem,
  validateAppointment,
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  getValidationRules,
  validateWithRules,
} from './validation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  const verification = verifyToken(token);

  if (!verification.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify session is still active
  const sessionValid = await verifySession(verification.decoded.sub, token);
  if (!sessionValid.valid) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.user = verification.decoded;
  req.token = token;
  next();
};

// Role-based access control middleware
const roleMiddleware = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        requiredRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

/**
 * POST /api/auth/login
 * User login with email and password
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check login attempts
    const rateCheck = await checkLoginAttempts(email, ipAddress);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.message,
        retryAfter: rateCheck.lockedUntil,
      });
    }

    // Validate credentials
    const validation = await validateCredentials(email, password);

    if (!validation.valid) {
      // Record failed attempt
      await recordLoginAttempt(email, ipAddress, userAgent, false);

      return res.status(401).json({ error: validation.error });
    }

    // Record successful attempt
    await recordLoginAttempt(email, ipAddress, userAgent, true);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      validation.user.id,
      validation.user.email,
      validation.user.role
    );

    // Create session
    const sessionResult = await createSession(
      validation.user.id,
      accessToken,
      ipAddress,
      userAgent
    );

    if (!sessionResult.success) {
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Log authentication action
    await logAuthAction(validation.user.id, 'LOGIN', ipAddress);

    // Update last login timestamp
    await supabase
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', validation.user.id);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: validation.user.id,
        email: validation.user.email,
        role: validation.user.role,
      },
      expiresIn: 86400, // 24 hours in seconds
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    const verification = verifyToken(refreshToken);
    if (!verification.valid || verification.decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Get user info
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', verification.decoded.sub)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    // Generate new access token
    const { accessToken: newAccessToken } = generateTokens(
      user.id,
      user.email,
      userRole?.role || 'receptionist'
    );

    res.json({
      accessToken: newAccessToken,
      expiresIn: 86400,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout and revoke session
 */
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const revokeResult = await revokeSession(req.user.sub, req.token);

    if (!revokeResult.success) {
      return res.status(500).json({ error: 'Logout failed' });
    }

    await logAuthAction(req.user.sub, 'LOGOUT', req.ip);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/verify-role
 * Verify user can switch to requested role
 */
app.post('/api/auth/verify-role', authMiddleware, async (req, res) => {
  try {
    const { requestedRole } = req.body;

    if (!requestedRole) {
      return res.status(400).json({ error: 'Requested role is required' });
    }

    // Check if user has permission for this role
    const permission = await checkPermission(req.user.sub, `role:${requestedRole}`);

    if (!permission.allowed) {
      return res.status(403).json({
        error: 'You do not have permission to switch to this role',
      });
    }

    // Generate new token with updated role
    const { accessToken: newToken } = generateTokens(
      req.user.sub,
      req.user.email,
      requestedRole
    );

    res.json({
      success: true,
      token: newToken,
      role: requestedRole,
    });
  } catch (error) {
    console.error('Role verification error:', error);
    res.status(500).json({ error: 'Role verification failed' });
  }
});

// ==================== PATIENT ENDPOINTS ====================

/**
 * POST /api/patients
 * Create a new patient with validation
 */
app.post('/api/patients', authMiddleware, roleMiddleware(['receptionist', 'super_admin', 'clinic_manager']), async (req, res) => {
  try {
    const patientData = {
      name: sanitizeString(req.body.name),
      phone: sanitizePhone(req.body.phone),
      email: req.body.email ? sanitizeEmail(req.body.email) : null,
      dob: req.body.dob,
      gender: req.body.gender,
      address: sanitizeString(req.body.address || ''),
      insuranceType: req.body.insuranceType,
      insuranceProvider: req.body.insuranceProvider,
      insuranceNumber: sanitizeString(req.body.insuranceNumber || ''),
      nhifAuthNumber: sanitizeString(req.body.nhifAuthNumber || ''),
    };

    // Validate patient data
    const validation = await validatePatient(patientData);

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    // Generate sequential patient ID
    const { data: lastPatient, error: lastError } = await supabase
      .from('patients')
      .select('patient_id')
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (!lastError && lastPatient && lastPatient.length > 0) {
      const match = lastPatient[0].patient_id.match(/P0*(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const patientNumber = `P${nextNumber.toString().padStart(3, '0')}`;

    // Insert patient record
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({
        patient_number: patientNumber,
        name: patientData.name,
        phone: patientData.phone,
        email: patientData.email,
        dob: patientData.dob,
        gender: patientData.gender,
        address: patientData.address,
        insurance_type: patientData.insuranceType,
        insurance_provider: patientData.insuranceProvider,
        insurance_policy_number: patientData.insuranceNumber,
        insurance_member_number: patientData.insuranceNumber,
        created_by: req.user.sub,
        registered_by: req.user.sub,
      })
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log action
    await logAuthAction(
      req.user.sub,
      'CREATE_PATIENT',
      req.ip
    );

    res.status(201).json({
      success: true,
      patient: newPatient[0],
      message: 'Patient registered successfully',
    });
  } catch (error) {
    console.error('Patient creation error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

/**
 * GET /api/patients/:id
 * Get patient details
 */
app.get('/api/patients/:id', authMiddleware, async (req, res) => {
  try {
    const patientId = req.params.id;

    const { data: patient, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (error || !patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check access permissions based on role
    const allowAccess = checkPatientAccess(req.user, patient);
    if (!allowAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, patient });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

/**
 * PUT /api/patients/:id
 * Update patient with validation
 */
app.put('/api/patients/:id', authMiddleware, roleMiddleware(['receptionist', 'super_admin', 'clinic_manager']), async (req, res) => {
  try {
    const patientId = req.params.id;

    // Validate updated data
    const validation = await validatePatient(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { data: updated, error } = await supabase
      .from('patients')
      .update({
        name: sanitizeString(req.body.name),
        phone: sanitizePhone(req.body.phone),
        email: req.body.email ? sanitizeEmail(req.body.email) : null,
        gender: req.body.gender,
        address: sanitizeString(req.body.address || ''),
        insurance_type: req.body.insuranceType,
        insurance_provider: req.body.insuranceProvider,
        insurance_policy_number: req.body.insuranceNumber,
        updated_by: req.user.sub,
        updated_at: new Date().toISOString(),
      })
      .eq('id', patientId)
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log action
    await logAuthAction(req.user.sub, 'UPDATE_PATIENT', req.ip);

    res.json({
      success: true,
      patient: updated[0],
      message: 'Patient updated successfully',
    });
  } catch (error) {
    console.error('Patient update error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

/**
 * GET /api/patients
 * List patients with filtering and pagination
 */
app.get('/api/patients', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('patients').select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (status) {
      // Status filtering would go here
    }

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: patients, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('List patients error:', error);
    res.status(500).json({ error: 'Failed to list patients' });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if user can access patient based on role
 */
function checkPatientAccess(user, patient) {
  switch (user.role) {
    case 'super_admin':
    case 'clinic_manager':
      return true;

    case 'receptionist':
      return true; // Receptionists can see all patients

    case 'optometrist':
      return patient.assigned_optometrist === user.sub || user.role === 'super_admin';

    case 'pharmacist':
      return patient.status === 'IN_PHARMACY' || patient.status === 'PENDING_BILLING';

    case 'optical_dispenser':
      return patient.status === 'IN_OPTICAL' || patient.status === 'PENDING_BILLING';

    case 'billing_officer':
      return patient.status === 'PENDING_BILLING' || patient.status === 'COMPLETED';

    default:
      return false;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Enhanced API server running on port ${PORT}`);
  console.log(`📊 Authentication enabled with JWT tokens`);
  console.log(`🔐 Role-based access control active`);
  console.log(`✔️  Input validation enabled`);
});

export default app;
