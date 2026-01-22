/**
 * Enhanced Backend API Server
 * Implements authentication, authorization, input validation, and RBAC
 * Run with: node server/enhanced-api.js
 */

import './env.js';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
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
  validatePatientPartial,
  validatePrescription,
  validateBillItem,
  validateAppointment,
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  getValidationRules,
  validateWithRules,
} from './validation.js';

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
 * Get patient details with latest prescription and bill items
 */
app.get('/api/patients/:id', authMiddleware, async (req, res) => {
  try {
    const patientId = req.params.id;

    let query = supabase.from('patients').select('*').eq('id', patientId);
    const { data: patient, error } = await query.single();

    if (error || !patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const allowAccess = checkPatientAccess(req.user, patient);
    if (!allowAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let prescriptions = [];
    let billItems = [];
    try {
      const [rxRes, biRes] = await Promise.all([
        supabase.from('prescriptions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('bill_items').select('*').eq('patient_id', patientId),
      ]);
      if (!rxRes.error) prescriptions = rxRes.data || [];
      if (!biRes.error) billItems = biRes.data || [];
    } catch (_) {
      // tables may not exist yet; return patient without rx/bill
    }

    const latestRx = prescriptions[0];
    const prescription = latestRx ? {
      od: latestRx.od,
      os: latestRx.os,
      add: latestRx.add_od || latestRx.add_os,
      addOd: latestRx.add_od,
      addOs: latestRx.add_os,
      edgeColor: latestRx.edge_color,
      medications: latestRx.medications || [],
    } : null;

    const billItemsMapped = billItems.map((b) => ({
      id: b.external_id || b.id,
      description: b.description,
      amount: parseFloat(b.amount),
      category: b.category,
      isCoveredByNHIF: !!b.is_covered_by_nhif,
      isCoveredByPrivate: b.is_covered_by_private !== false,
    }));

    const patientOut = mapPatientToFrontend(patient);
    patientOut.prescription = prescription;
    patientOut.billItems = billItemsMapped;
    patientOut.prescriptionHistory = prescriptions.slice(1).map((p) => ({
      date: p.created_at,
      od: p.od,
      os: p.os,
      addOd: p.add_od,
      addOs: p.add_os,
      dispensedItems: [],
      providerName: '',
    }));

    res.json({ success: true, patient: patientOut });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

const PATIENT_UPDATE_ROLES = ['receptionist', 'super_admin', 'clinic_manager', 'optometrist', 'pharmacist', 'optical_dispenser', 'billing_officer'];

/**
 * PUT /api/patients/:id
 * Update patient (demographics and/or EMR). Supports partial updates.
 */
app.put('/api/patients/:id', authMiddleware, roleMiddleware(PATIENT_UPDATE_ROLES), async (req, res) => {
  try {
    const patientId = req.params.id;

    const { data: existing } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (!existing) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (!checkPatientAccess(req.user, existing)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const validation = await validatePatientPartial(req.body, { excludePatientId: patientId });
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
    }

    const u = {};
    if (req.body.name !== undefined) u.name = sanitizeString(req.body.name);
    if (req.body.phone !== undefined) u.phone = sanitizePhone(req.body.phone);
    if (req.body.email !== undefined) u.email = req.body.email ? sanitizeEmail(req.body.email) : null;
    if (req.body.gender !== undefined) u.gender = req.body.gender;
    if (req.body.address !== undefined) u.address = sanitizeString(req.body.address || '');
    if (req.body.insuranceType !== undefined) u.insurance_type = req.body.insuranceType;
    if (req.body.insuranceProvider !== undefined) u.insurance_provider = req.body.insuranceProvider;
    if (req.body.insuranceNumber !== undefined) u.insurance_policy_number = req.body.insuranceNumber;
    if (req.body.nhifAuthNumber !== undefined) u.nhif_auth_number = sanitizeString(req.body.nhifAuthNumber || '');
    if (req.body.status !== undefined) u.status = req.body.status;
    if (req.body.checkedInAt !== undefined) u.checked_in_at = req.body.checkedInAt;
    if (req.body.assignedProviderId !== undefined) u.assigned_provider_id = req.body.assignedProviderId || null;
    if (req.body.chiefComplaint !== undefined) u.chief_complaint = sanitizeString(req.body.chiefComplaint || '');
    if (req.body.clinicalNotes !== undefined) u.clinical_notes = sanitizeString(req.body.clinicalNotes || '');
    if (req.body.consultationNotes !== undefined) u.consultation_notes = sanitizeString(req.body.consultationNotes || '');
    if (req.body.ophthalmologistNotes !== undefined) u.ophthalmologist_notes = sanitizeString(req.body.ophthalmologistNotes || '');
    if (req.body.diagnosis !== undefined) u.diagnosis = sanitizeString(req.body.diagnosis || '');
    if (req.body.appointment !== undefined) u.appointment = req.body.appointment;
    u.updated_by = req.user.sub;
    u.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('patients')
      .update(u)
      .eq('id', patientId)
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const prescription = req.body.prescription;
    if (prescription && typeof prescription === 'object') {
      const rxVal = validatePrescription({
        od: prescription.od,
        os: prescription.os,
        add: prescription.addOd || prescription.addOs || prescription.add,
      });
      if (rxVal.isValid) {
        await supabase.from('prescriptions').insert({
          patient_id: patientId,
          od: prescription.od,
          os: prescription.os,
          add_od: prescription.addOd,
          add_os: prescription.addOs,
          edge_color: prescription.edgeColor,
          sphere_od: prescription.sphereOD,
          sphere_os: prescription.sphereOS,
          cylinder_od: prescription.cylinderOD,
          cylinder_os: prescription.cylinderOS,
          axis_od: prescription.axisOD,
          axis_os: prescription.axisOS,
          prism_od: prescription.prismOD,
          prism_os: prescription.prismOS,
          base_od: prescription.baseOD,
          base_os: prescription.baseOS,
          pupillary_distance: prescription.pupillaryDistance,
          segment_height: prescription.segmentHeight,
          lens_type: prescription.lensType,
          medications: prescription.medications || [],
          created_by: req.user.sub,
        });
      }
    }

    const billItems = req.body.billItems;
    if (Array.isArray(billItems) && billItems.length > 0) {
      await supabase.from('bill_items').delete().eq('patient_id', patientId);
      for (const it of billItems) {
        const biVal = validateBillItem(it);
        if (!biVal.isValid) continue;
        await supabase.from('bill_items').insert({
          patient_id: patientId,
          external_id: it.id,
          description: sanitizeString(it.description),
          amount: parseFloat(it.amount),
          category: it.category,
          is_covered_by_nhif: !!it.isCoveredByNHIF,
          is_covered_by_private: it.isCoveredByPrivate !== false,
          created_by: req.user.sub,
        });
      }
    }

    await logAuthAction(req.user.sub, 'UPDATE_PATIENT', req.ip);

    const patientOut = mapPatientToFrontend(updated[0]);
    res.json({ success: true, patient: patientOut, message: 'Patient updated successfully' });
  } catch (error) {
    console.error('Patient update error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

/**
 * POST /api/patients/:id/prescriptions
 * Create prescription for patient
 */
app.post('/api/patients/:id/prescriptions', authMiddleware, roleMiddleware(PATIENT_UPDATE_ROLES), async (req, res) => {
  try {
    const patientId = req.params.id;
    const body = req.body || {};

    const { data: patient, error: pe } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (pe || !patient) return res.status(404).json({ error: 'Patient not found' });
    if (!checkPatientAccess(req.user, patient)) return res.status(403).json({ error: 'Access denied' });

    const rxVal = validatePrescription({
      od: body.od,
      os: body.os,
      add: body.addOd || body.addOs || body.add,
      clinicalNotes: body.clinicalNotes,
      diagnosis: body.diagnosis,
    });
    if (!rxVal.isValid) {
      return res.status(400).json({ error: 'Validation failed', errors: rxVal.errors });
    }

    const { data: rx, error } = await supabase
      .from('prescriptions')
      .insert({
        patient_id: patientId,
        od: body.od,
        os: body.os,
        add_od: body.addOd,
        add_os: body.addOs,
        edge_color: body.edgeColor,
        sphere_od: body.sphereOD,
        sphere_os: body.sphereOS,
        cylinder_od: body.cylinderOD,
        cylinder_os: body.cylinderOS,
        axis_od: body.axisOD,
        axis_os: body.axisOS,
        prism_od: body.prismOD,
        prism_os: body.prismOS,
        base_od: body.baseOD,
        base_os: body.baseOS,
        pupillary_distance: body.pupillaryDistance,
        segment_height: body.segmentHeight,
        lens_type: body.lensType,
        medications: body.medications || [],
        created_by: req.user.sub,
      })
      .select('*');

    if (error) return res.status(400).json({ error: error.message });

    await logAuthAction(req.user.sub, 'CREATE_PRESCRIPTION', req.ip);
    res.status(201).json({ success: true, prescription: rx[0], message: 'Prescription created' });
  } catch (err) {
    console.error('Create prescription error:', err);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

/**
 * GET /api/patients/:id/prescriptions
 * List prescriptions (history) for patient
 */
app.get('/api/patients/:id/prescriptions', authMiddleware, async (req, res) => {
  try {
    const patientId = req.params.id;
    const { data: patient, error: pe } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (pe || !patient) return res.status(404).json({ error: 'Patient not found' });
    if (!checkPatientAccess(req.user, patient)) return res.status(403).json({ error: 'Access denied' });

    const { data: rows, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const history = (rows || []).map((p) => ({
      id: p.id,
      date: p.created_at,
      od: p.od,
      os: p.os,
      addOd: p.add_od,
      addOs: p.add_os,
      medications: p.medications || [],
    }));

    res.json({ success: true, prescriptions: history });
  } catch (err) {
    console.error('Get prescriptions error:', err);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

/**
 * GET /api/patients/:id/prescriptions/history
 * Alias for prescription history (same as GET /prescriptions).
 */
app.get('/api/patients/:id/prescriptions/history', authMiddleware, async (req, res) => {
  try {
    const patientId = req.params.id;
    const { data: patient, error: pe } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (pe || !patient) return res.status(404).json({ error: 'Patient not found' });
    if (!checkPatientAccess(req.user, patient)) return res.status(403).json({ error: 'Access denied' });

    const { data: rows, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const history = (rows || []).map((p) => ({
      id: p.id,
      date: p.created_at,
      od: p.od,
      os: p.os,
      addOd: p.add_od,
      addOs: p.add_os,
      medications: p.medications || [],
    }));

    res.json({ success: true, prescriptions: history });
  } catch (err) {
    console.error('Get prescription history error:', err);
    res.status(500).json({ error: 'Failed to fetch prescription history' });
  }
});

/**
 * POST /api/patients/:id/bill-items
 * Add bill item(s) for patient
 */
app.post('/api/patients/:id/bill-items', authMiddleware, roleMiddleware(PATIENT_UPDATE_ROLES), async (req, res) => {
  try {
    const patientId = req.params.id;
    const items = Array.isArray(req.body) ? req.body : (req.body.billItems ? req.body.billItems : [req.body]);

    const { data: patient, error: pe } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (pe || !patient) return res.status(404).json({ error: 'Patient not found' });
    if (!checkPatientAccess(req.user, patient)) return res.status(403).json({ error: 'Access denied' });

    const inserted = [];
    for (const it of items) {
      const biVal = validateBillItem(it);
      if (!biVal.isValid) continue;
      const { data: bi, error } = await supabase
        .from('bill_items')
        .insert({
          patient_id: patientId,
          external_id: it.id,
          description: sanitizeString(it.description),
          amount: parseFloat(it.amount),
          category: it.category,
          is_covered_by_nhif: !!it.isCoveredByNHIF,
          is_covered_by_private: it.isCoveredByPrivate !== false,
          created_by: req.user.sub,
        })
        .select('*');
      if (!error && bi && bi[0]) inserted.push(bi[0]);
    }

    await logAuthAction(req.user.sub, 'CREATE_BILL_ITEM', req.ip);
    res.status(201).json({ success: true, billItems: inserted, message: 'Bill item(s) added' });
  } catch (err) {
    console.error('Create bill item error:', err);
    res.status(500).json({ error: 'Failed to add bill item(s)' });
  }
});

/**
 * GET /api/patients/:id/billing
 * Get bill items and totals for patient
 */
app.get('/api/patients/:id/billing', authMiddleware, async (req, res) => {
  try {
    const patientId = req.params.id;
    const { data: patient, error: pe } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (pe || !patient) return res.status(404).json({ error: 'Patient not found' });
    if (!checkPatientAccess(req.user, patient)) return res.status(403).json({ error: 'Access denied' });

    const { data: rows, error } = await supabase.from('bill_items').select('*').eq('patient_id', patientId);
    if (error) return res.status(400).json({ error: error.message });

    const billItems = (rows || []).map((b) => ({
      id: b.external_id || b.id,
      description: b.description,
      amount: parseFloat(b.amount),
      category: b.category,
      isCoveredByNHIF: !!b.is_covered_by_nhif,
      isCoveredByPrivate: b.is_covered_by_private !== false,
    }));

    const total = billItems.reduce((s, b) => s + b.amount, 0);
    res.json({ success: true, patientId, billItems, total });
  } catch (err) {
    console.error('Get billing error:', err);
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

/**
 * DELETE /api/patients/:id
 * Soft-delete patient
 */
app.delete('/api/patients/:id', authMiddleware, roleMiddleware(['receptionist', 'super_admin', 'clinic_manager']), async (req, res) => {
  try {
    const patientId = req.params.id;
    const { data: existing, error: fe } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (fe || !existing) return res.status(404).json({ error: 'Patient not found' });

    const { error } = await supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString(), updated_by: req.user.sub, updated_at: new Date().toISOString() })
      .eq('id', patientId);

    if (error) return res.status(400).json({ error: error.message });
    await logAuthAction(req.user.sub, 'DELETE_PATIENT', req.ip);
    res.json({ success: true, message: 'Patient deleted' });
  } catch (err) {
    console.error('Delete patient error:', err);
    res.status(500).json({ error: 'Failed to delete patient' });
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

function mapPatientToFrontend(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || undefined,
    dob: row.dob,
    address: row.address || undefined,
    gender: row.gender,
    insuranceType: row.insurance_type,
    insuranceProvider: row.insurance_provider,
    insuranceNumber: row.insurance_policy_number || row.insurance_member_number,
    nhifAuthNumber: row.nhif_auth_number,
    status: row.status || 'WAITING',
    assignedProviderId: row.assigned_provider_id,
    checkedInAt: row.checked_in_at || row.created_at,
    chiefComplaint: row.chief_complaint,
    clinicalNotes: row.clinical_notes,
    consultationNotes: row.consultation_notes,
    ophthalmologistNotes: row.ophthalmologist_notes,
    diagnosis: row.diagnosis,
    appointment: row.appointment,
  };
}

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
      return patient.assigned_provider_id === user.sub || patient.assigned_optometrist === user.sub || user.role === 'super_admin';

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
