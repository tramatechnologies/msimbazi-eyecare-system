# Frontend Component Updates - Backend Integration

## Overview

Updated all frontend views to use the new `patientService` API layer instead of direct context manipulation. This ensures all patient operations go through the backend API with proper authentication, validation, and audit logging.

## Updated Components

### 1. Registration.tsx
**Changes:**
- Added import for `patientService`
- Updated `handleCompleteRegistration()` to call `patientService.createPatient()` and `patientService.updatePatient()`
- Added try-catch error handling for backend API calls
- Validation errors from backend are properly displayed to users

**Key Pattern:**
```typescript
try {
  // For new patients
  const result = await patientService.createPatient(newPatientData);
  
  // For returning patients
  await patientService.updatePatient(selectedPatientId, updateData);
  
  showSuccess('Patient registered successfully');
} catch (error) {
  showError(error.message);
}
```

### 2. Clinical.tsx
**Changes:**
- Added import for `patientService`
- Ready for integration with prescription creation via backend
- Future: Replace direct context calls with `patientService.createPrescription()`

**Next Step:**
When creating prescriptions, use:
```typescript
await patientService.createPrescription(patientId, prescriptionData);
```

### 3. Billing.tsx
**Changes:**
- Added import for `patientService`
- Updated `handleProcessPayment()` to call `patientService.updatePatient()`
- Changed from context-based result checking to try-catch error handling
- Patient status now updated via backend API

**Key Pattern:**
```typescript
try {
  await patientService.updatePatient(selectedId, { status: PatientStatus.COMPLETED });
  showSuccess('Payment processed');
} catch (error) {
  showError(error.message);
}
```

### 4. Pharmacy.tsx
**Changes:**
- Added import for `patientService`
- Updated `handleCompleteDispensing()` to call `patientService.updatePatient()`
- Medication dispensing now recorded via backend with audit trail
- Changed from context-based result checking to try-catch error handling

**Key Pattern:**
```typescript
try {
  await patientService.updatePatient(activePatient.id, {
    status: PatientStatus.PENDING_BILLING,
    billItems: [...activePatient.billItems, ...newBillItems]
  });
  showSuccess('Dispensing recorded');
} catch (error) {
  showError(error.message);
}
```

### 5. OpticalDispensing.tsx
**Changes:**
- Added import for `patientService`
- Updated `handleCompleteDispensing()` to call `patientService.updatePatient()`
- Optical orders now recorded via backend with patient routing logic
- Prescription updates and bill items added via API

**Key Pattern:**
```typescript
try {
  await patientService.updatePatient(activePatient.id, {
    status: nextStatus,
    prescription: { ...activePatient.prescription, od, os, addOd, addOs },
    billItems: [...]
  });
  showSuccess('Order submitted');
} catch (error) {
  showError(error.message);
}
```

### 6. PatientsList.tsx
**Status:** No changes needed - uses context for read-only patient list display (search & filter)

**Future Enhancement:**
For better performance with large patient lists, could integrate:
```typescript
const { data, pagination } = await patientService.listPatients({
  page: currentPage,
  limit: 20,
  search: searchTerm,
  status: filterStatus
});
```

## Common Pattern for All Updates

### Before (Context-based):
```typescript
const { updatePatient } = usePatients();

const result = await updatePatient(id, data);
if (result.success) {
  showSuccess('Success message');
} else {
  showError(result.error);
}
```

### After (API-based):
```typescript
import * as patientService from '../services/patientService';

try {
  await patientService.updatePatient(id, data);
  showSuccess('Success message');
} catch (error) {
  showError(error instanceof Error ? error.message : 'Error occurred');
}
```

## Error Handling

All components now use try-catch blocks for API calls:

```typescript
try {
  // API call
  await patientService.createPatient(data);
  showSuccess('Operation completed');
} catch (error) {
  // Error message from backend validation or network error
  showError(error instanceof Error ? error.message : 'Failed to complete operation');
}
```

Backend errors include:
- Validation errors (invalid phone, duplicate insurance number, etc.)
- Authentication errors (token expired, insufficient permissions)
- Server errors (database issues, etc.)

## Data Flow

### Old Flow (Context-based):
```
User Input → Component → PatientContext 
→ localStorage → UI State
```

### New Flow (API-based):
```
User Input → Component → patientService 
→ Backend API → Database
→ Response → Component State → UI
```

## Security Benefits

1. **Server-Side Validation**: All input validated on backend
2. **Authentication**: JWT token verified for every API call
3. **Authorization**: Role-based access control enforced at API level
4. **Audit Logging**: All operations logged with user ID, timestamp, IP
5. **Data Encryption**: Sensitive fields encrypted in database
6. **No localStorage**: Patient data no longer stored client-side

## API Endpoints Used

| Component | Endpoint | Method | Purpose |
|-----------|----------|--------|---------|
| Registration | `/api/patients` | POST | Create new patient |
| Registration | `/api/patients/:id` | PUT | Update returning patient |
| Billing | `/api/patients/:id` | PUT | Update patient status to COMPLETED |
| Pharmacy | `/api/patients/:id` | PUT | Add bill items, update status |
| Optical | `/api/patients/:id` | PUT | Add prescription, bill items, update status |

## Next Steps

1. ✅ Updated 5 major components with patientService integration
2. ✅ Implemented error handling with try-catch blocks
3. ⏳ Test all workflows end-to-end with backend running
4. ⏳ Verify patient data persists in Supabase database
5. ⏳ Confirm audit logs are being created for all operations
6. ⏳ Monitor browser console and server logs for any issues

## Testing Checklist

- [ ] Registration: Create new patient - verify appears in database
- [ ] Registration: Update returning patient - verify changes in database
- [ ] Billing: Process payment - verify status changes to COMPLETED
- [ ] Pharmacy: Dispense medication - verify bill items added
- [ ] Optical: Submit order - verify prescription and bill items saved
- [ ] All operations: Check audit logs in database
- [ ] Error cases: Test with invalid data - verify backend validation errors shown
- [ ] Authentication: Test with expired token - verify proper error handling

## Known Limitations

1. PatientsList still uses context - could be optimized for pagination from backend
2. Clinical view imports patientService but not fully integrated yet
3. Prescription creation flow needs additional backend endpoint
4. Real-time updates not implemented (would require WebSocket/polling)

## Support

If components fail to save data:
1. Check browser console for error messages
2. Check network tab to see API response
3. Verify backend server is running (`npm run dev:server`)
4. Check server logs for validation or database errors
5. Verify user is authenticated (check `sessionStorage` for tokens)
