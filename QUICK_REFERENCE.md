# Quick Reference Guide

## File Locations & Purpose

```
server/
  ├── auth.js              # Authentication module (JWT, sessions, rate-limiting)
  ├── validation.js        # Input validation & sanitization
  └── enhanced-api.js      # Express API server with all endpoints

services/
  └── patientService.ts    # Patient API client functions

contexts/
  └── AuthContext.tsx      # Authentication state management (updated)

views/
  └── Login.tsx            # Login interface (updated)

database/
  └── migrations/
      └── 003_*.sql        # Encryption, validation, security tables
```

## Quick Code Snippets

### Frontend Authentication

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { login, logout, isAuthenticated, user } = useAuth();

  const handleLogin = async () => {
    await login('email@example.com', 'password');
  };

  return (
    <div>
      {isAuthenticated && <p>Welcome {user?.email}</p>}
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
```

### Calling Backend APIs

```typescript
import { createPatient, listPatients } from '../services/patientService';

async function handleCreatePatient(data) {
  try {
    const result = await createPatient({
      name: data.name,
      phone: data.phone,
      dob: data.dob,
      gender: data.gender,
      insuranceType: data.insuranceType,
      insuranceNumber: data.insuranceNumber,
    });
    console.log('Patient created:', result.patient);
  } catch (error) {
    console.error('Failed to create patient:', error.message);
  }
}
```

### Server Validation

```typescript
// In server/enhanced-api.js, validation is automatic:
app.post('/api/patients', authMiddleware, async (req, res) => {
  const errors = validatePatient(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }
  // Proceed with creation
});
```

## Common Tasks

### Check If User Is Authenticated

```typescript
const { isAuthenticated, user } = useAuth();

if (!isAuthenticated) {
  return <Login />;
}
```

### Get User's Current Role

```typescript
const { user } = useAuth();
console.log(user.role); // 'optometrist', 'pharmacist', etc.
```

### Add Protected Route

```typescript
function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Login />;
  if (requiredRole && user.role !== requiredRole) return <Unauthorized />;

  return children;
}
```

### Create Patient (Frontend)

```typescript
import { createPatient } from '../services/patientService';

const result = await createPatient({
  name: 'John Mwangi',
  phone: '0712345678',
  email: 'john@example.com',
  dob: '1990-05-15',
  gender: 'Male',
  address: '123 Main St',
  insuranceType: 'NHIF',
  insuranceNumber: 'NH-123456',
});
```

### List Patients with Search

```typescript
import { listPatients } from '../services/patientService';

const patients = await listPatients({
  page: 1,
  limit: 20,
  search: 'john',
  status: 'WAITING',
});
```

### Handle Authentication Errors

```typescript
try {
  await login(email, password);
} catch (error) {
  if (error.message.includes('rate limit')) {
    alert('Too many login attempts. Please try again later.');
  } else if (error.message.includes('Invalid')) {
    alert('Invalid email or password.');
  } else {
    alert('Login failed: ' + error.message);
  }
}
```

## Environment Variables

```env
# Frontend
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Backend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:3000
PORT=3001
GEMINI_API_KEY=your_api_key
```

## Validation Patterns

### Phone Number
```
Format: 07XXXXXXXX (10 digits, starts with 07)
Example: 0712345678
```

### Email
```
Format: valid email address
Example: user@example.com
```

### Prescription
```
Format: ±#.##DS (optical power notation)
Example: -2.00 DS, +1.50 DS, -1.25 DS
```

### Insurance Number
```
NHIF: 10-20 digits (e.g., NH-123456789)
Private: alphanumeric (e.g., INS-A1B2C3)
```

## Roles & Permissions

| Role | Create Patient | View All Patients | View Assigned | Create Prescription | Dispense Medication | Process Payment |
|------|---|---|---|---|---|---|
| super_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| clinic_manager | ✓ | ✓ | ✓ | - | - | ✓ |
| receptionist | ✓ | ✓ | - | - | - | - |
| optometrist | - | - | ✓ | ✓ | - | - |
| pharmacist | - | - | ✓ | - | ✓ | - |
| optical_dispenser | - | - | ✓ | - | ✓ | - |
| billing_officer | - | ✓ | - | - | - | ✓ |

## API Endpoints Summary

| Method | Endpoint | Role Required | Purpose |
|--------|----------|---------------|---------|
| POST | /api/auth/login | - | User login |
| POST | /api/auth/refresh | Authenticated | Refresh token |
| POST | /api/auth/logout | Authenticated | User logout |
| POST | /api/auth/verify-role | Authenticated | Verify role change |
| POST | /api/patients | Receptionist+ | Create patient |
| GET | /api/patients | Authenticated | List patients |
| GET | /api/patients/:id | Authenticated | Get patient |
| PUT | /api/patients/:id | Receptionist+ | Update patient |

## Debugging

### Check if Tokens Are Stored
```javascript
console.log(sessionStorage.getItem('accessToken'));
console.log(sessionStorage.getItem('refreshToken'));
```

### Verify API Call Headers
```javascript
const token = sessionStorage.getItem('accessToken');
console.log('Authorization:', `Bearer ${token}`);
```

### Test Backend Endpoint
```bash
curl -X GET http://localhost:3001/api/patients \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Check Database RLS
```sql
-- In Supabase SQL Editor
SELECT * FROM auth.users;
SELECT * FROM public.user_roles;
SELECT * FROM public.patients LIMIT 5;
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid credentials" | Wrong email/password | Verify credentials, check user exists |
| "Insufficient permissions" | User role lacks access | Check user's assigned role |
| "Token invalid or expired" | Token has expired | Use refresh token or re-login |
| "Rate limit exceeded" | Too many login attempts | Wait 15 minutes and try again |
| "Validation failed" | Invalid input data | Check field formats match requirements |
| "CORS error" | Browser blocking request | Check CORS_ORIGIN configuration |
| "Patient not found" | Patient ID doesn't exist | Verify patient ID is correct |

## Next Steps

1. **Update remaining components** to use `patientService` instead of context
2. **Add error handling** for API calls and user feedback
3. **Implement token refresh** before expiration
4. **Create test accounts** for each role
5. **Test all workflows** end-to-end
6. **Deploy to production** when ready

## Support

For issues or questions:
1. Check this quick reference
2. Review BACKEND_IMPLEMENTATION.md for detailed docs
3. Check server logs: `npm run dev:server`
4. Check browser console for frontend errors
5. Check database via Supabase dashboard

## Production Checklist

Before deploying:
- [ ] All environment variables configured
- [ ] SSL certificates installed
- [ ] CORS origin set to production domain
- [ ] JWT secret changed to secure random value
- [ ] Database backups enabled
- [ ] Monitoring and error tracking configured
- [ ] Admin user created
- [ ] Rate limiting configured
- [ ] All API endpoints tested
- [ ] Frontend components updated for backend
