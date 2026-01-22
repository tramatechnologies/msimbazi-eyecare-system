# Backend Authentication & Data Security Implementation

## Overview

This document describes the production-grade backend authentication system implemented using Supabase, JWT tokens, and Postgres with Row-Level Security (RLS).

## Architecture

### Components

1. **Authentication Module** (`server/auth.js`)
   - JWT token generation and verification
   - Session management
   - Login attempt tracking and rate limiting
   - Password validation
   - Token refresh mechanism

2. **Input Validation Module** (`server/validation.js`)
   - Server-side validation for all data entry points
   - Dynamic validation rules from database
   - Sanitization and XSS prevention
   - Type-specific validators (phone, email, prescription, etc.)

3. **API Server** (`server/enhanced-api.js`)
   - Express.js backend with authentication middleware
   - Role-based access control (RBAC)
   - Patient management endpoints
   - Audit logging
   - Error handling

4. **Frontend Services**
   - Updated `AuthContext.tsx`: Real backend authentication
   - New `patientService.ts`: Patient API calls with auth headers
   - Updated `Login.tsx`: Backend-driven authentication

### Database Schema

#### Tables Created
- `encryption_keys` - Encryption key management
- `encrypted_fields` - Track which fields are encrypted
- `password_history` - Password change history
- `login_attempts` - Failed login tracking
- `validation_rules` - Dynamic validation rules
- Enhanced `audit_logs` - Comprehensive audit trail
- Enhanced `user_sessions` - Session management with expiration

#### Row-Level Security Policies
- **patients**: Role-based access (admin, manager, receptionist, optometrist, etc.)
- **bill_items**: Inherited from patient access
- **prescriptions**: Optometrist access to assigned patients
- **audit_logs**: Admin and manager read-only

## Security Features

### 1. Authentication

**Flow:**
```
User Email/Password 
    ↓
Backend Validation (Supabase Auth)
    ↓
JWT Token Generation (24h expiry)
    ↓
Refresh Token (7d expiry)
    ↓
Session Recording in Database
```

**Key Features:**
- Rate limiting (5 failed attempts → 15 min lockout)
- Login attempt tracking
- Session management with token hashing
- Automatic token expiration
- Token refresh mechanism

### 2. Authorization (RBAC)

**Roles:**
- `super_admin` - Full system access
- `clinic_manager` - Oversight and reporting
- `receptionist` - Patient registration and appointments
- `optometrist` - Clinical examination and prescriptions
- `pharmacist` - Medication dispensing
- `optical_dispenser` - Frame and lens dispensing
- `billing_officer` - Payment processing

**Permission Checking:**
- Backend verifies user role for every action
- Frontend enforces UI-level role restrictions
- Patient data access restricted by role and status

### 3. Data Validation

**Server-Side Validation:**
- All input validated before database insertion
- Regex patterns for phone, email, prescription format
- Age validation (0-150 years)
- Insurance number validation
- Bill amount validation (>0, <1,000,000)
- Text length limits (prevents abuse)

**Sanitization:**
- HTML tag removal
- JavaScript protocol removal
- Event handler removal
- Control character removal

### 4. Data Encryption & Audit

**Audit Logging:**
- All API actions logged with user ID, action, timestamp
- IP address and user agent recorded
- Sensitive operations tracked (LOGIN, CREATE_PATIENT, etc.)

**Data Protection:**
- Passwords hashed with bcryptjs
- Tokens hashed for session storage
- Sensitive fields marked in database

## API Endpoints

### Authentication Endpoints

#### `POST /api/auth/login`
Authenticate user with email and password.

**Request:**
```json
{
  "email": "receptionist@clinic.com",
  "password": "securepassword"
}
```

**Response (Success):**
```json
{
  "success": true,
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "receptionist@clinic.com",
    "role": "receptionist"
  },
  "expiresIn": 86400
}
```

**Response (Failure):**
```json
{
  "error": "Invalid credentials",
  "retryAfter": 1705945200000
}
```

#### `POST /api/auth/refresh`
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "expiresIn": 86400
}
```

#### `POST /api/auth/logout`
Revoke session and logout.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### `POST /api/auth/verify-role`
Verify user can switch to requested role.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "requestedRole": "optometrist"
}
```

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "role": "optometrist"
}
```

### Patient Endpoints

#### `POST /api/patients`
Create new patient (Receptionist, Admin, Manager only).

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "John Mwangi",
  "phone": "0712345678",
  "email": "john@example.com",
  "dob": "1990-05-15",
  "gender": "Male",
  "address": "123 Hospital Lane",
  "insuranceType": "NHIF",
  "insuranceProvider": "NHIF",
  "insuranceNumber": "NH-123456789",
  "nhifAuthNumber": "AUTH-12345678"
}
```

**Response (Success):**
```json
{
  "success": true,
  "patient": {
    "id": "uuid",
    "patient_number": "P001",
    "name": "John Mwangi",
    "phone": "0712345678",
    "status": "WAITING",
    "created_at": "2026-01-22T10:30:00Z"
  },
  "message": "Patient registered successfully"
}
```

**Response (Validation Error):**
```json
{
  "error": "Validation failed",
  "errors": {
    "phone": "Phone must be 10 digits starting with 07",
    "insurance_number": "Insurance number is required for this type"
  }
}
```

#### `GET /api/patients/:id`
Get patient details (role-based access).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "patient": {
    "id": "uuid",
    "patient_number": "P001",
    "name": "John Mwangi",
    "phone": "0712345678",
    "email": "john@example.com",
    "dob": "1990-05-15",
    "status": "IN_CLINICAL",
    "created_at": "2026-01-22T10:30:00Z"
  }
}
```

#### `GET /api/patients?page=1&limit=20&search=john`
List patients with pagination and search.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "patients": [
    { "id": "uuid", "name": "John Mwangi", "phone": "0712345678", ... },
    { "id": "uuid", "name": "Jane Smith", "phone": "0722334455", ... }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### `PUT /api/patients/:id`
Update patient details.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request:**
```json
{
  "phone": "0712345678",
  "address": "456 New Street",
  "insuranceType": "CASH"
}
```

**Response:**
```json
{
  "success": true,
  "patient": { ... },
  "message": "Patient updated successfully"
}
```

## Input Validation Rules

### Patient Fields

| Field | Rule | Example |
|-------|------|---------|
| name | min: 2, max: 255, alphanumeric+spaces | "John Mwangi" |
| phone | Format: 07XXXXXXXX | "0712345678" |
| email | Valid email format | "john@example.com" |
| dob | Valid date, age 0-150 | "1990-05-15" |
| gender | Male, Female, Other | "Male" |
| insuranceNumber | min: 3 chars, alphanumeric | "NH-123456" |
| nhifAuthNumber | 10+ digits | "1234567890" |

### Prescription Fields

| Field | Rule | Example |
|-------|------|---------|
| od | Format: ±#.##DS | "-2.00 DS" |
| os | Format: ±#.##DS | "-1.50 DS" |
| add | Format: ±#.##DS | "+1.50 DS" |
| clinicalNotes | max: 2000 chars | "Patient has myopia..." |
| diagnosis | max: 1000 chars | "Myopia" |

### Bill Item Fields

| Field | Rule | Example |
|-------|------|---------|
| description | 1-255 chars | "Comprehensive exam" |
| amount | 0 < amount < 1,000,000 | 25000 |
| category | CLINICAL, PHARMACY, OPTICAL | "CLINICAL" |

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local` with:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3001

# Backend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_secure_random_secret_key
CORS_ORIGIN=http://localhost:3000
PORT=3001

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Set Up Supabase Database

```bash
# Apply migrations
supabase migration up
```

### 4. Create Initial Users

Use Supabase Auth dashboard to create users with assigned roles in `user_roles` table.

### 5. Run Development Server

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend API
npm run dev:server

# Or both together
npm run dev:all
```

## Usage Examples

### Login Flow

```typescript
// Frontend
const { login } = useAuth();
const result = await login('receptionist@clinic.com', 'password');

if (result.success) {
  // Token automatically stored in sessionStorage
  // User is authenticated and can make API calls
}
```

### Making API Calls

```typescript
// Frontend
import { createPatient } from '../services/patientService';

const result = await createPatient({
  name: 'John Mwangi',
  phone: '0712345678',
  dob: '1990-05-15',
  gender: 'Male',
  insuranceType: 'NHIF',
  insuranceNumber: 'NH-123456789',
});
```

### Role-Based Access

```typescript
// Automatically enforced by backend
// Receptionist can create patients
// Optometrist can only view assigned patients
// Pharmacist can only see patients in PHARMACY status
```

## Testing

### Test Accounts

Use these for testing (create in Supabase Auth):

| Email | Password | Role |
|-------|----------|------|
| receptionist@test.com | password123 | receptionist |
| optometrist@test.com | password123 | optometrist |
| pharmacist@test.com | password123 | pharmacist |
| admin@test.com | password123 | super_admin |

### Testing with cURL

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"receptionist@test.com","password":"password123"}'

# Create patient
curl -X POST http://localhost:3001/api/patients \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Mwangi",
    "phone": "0712345678",
    "dob": "1990-05-15",
    "gender": "Male",
    "insuranceType": "NHIF",
    "insuranceNumber": "NH-123456"
  }'
```

## Security Checklist

- [x] Real backend authentication with JWT
- [x] Password validation against Supabase Auth
- [x] Server-side input validation
- [x] Rate limiting on login
- [x] Session management with expiration
- [x] Role-based access control (RBAC)
- [x] Row-Level Security (RLS) on database
- [x] Audit logging for all actions
- [x] Token refresh mechanism
- [x] HTTPS enforcement (configure in production)
- [x] CORS properly configured
- [ ] Production deployment with SSL certificates
- [ ] Regular security audits
- [ ] Database backups enabled
- [ ] Monitoring and alerting configured

## Production Deployment

### Before Going Live

1. **Change JWT_SECRET** to a secure random value
2. **Enable HTTPS** in production environment
3. **Configure CORS** for production domain
4. **Set up SSL certificates** (Let's Encrypt recommended)
5. **Configure database backups** (daily recommended)
6. **Enable rate limiting** on API gateway
7. **Set up monitoring** (error tracking, performance monitoring)
8. **Create admin user** with strong password
9. **Test all authentication flows** thoroughly
10. **Create runbooks** for common operations

### Environment Variables (Production)

```env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
JWT_SECRET=<generate-with-openssl-rand-hex-32>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production-key>
```

## Troubleshooting

### Common Issues

**Issue**: "Invalid credentials" on login
- Verify email and password are correct
- Check user exists in Supabase Auth
- Verify user has a role in user_roles table

**Issue**: "Insufficient permissions"
- Check user's role matches endpoint requirements
- Verify role-based access policy in database
- Check RLS policies are enabled

**Issue**: "Token invalid or expired"
- Token may have expired (24 hours)
- Use refresh token to get new access token
- Clear sessionStorage and re-login

## API Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Patient created |
| 400 | Bad request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not found | Patient ID doesn't exist |
| 429 | Too many requests | Login attempts exceeded |
| 500 | Server error | Database error |

## Further Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [JWT Guide](https://jwt.io/introduction)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
