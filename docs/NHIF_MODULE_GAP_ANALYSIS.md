# NHIF Module Gap Analysis - Current State vs Requirements

## ✅ **WHAT WE CURRENTLY HAVE**

### 1. **Basic NHIF Support in Registration**
- ✅ **Location**: `views/Registration.tsx`
- ✅ **Features**:
  - Insurance type selection (CASH / NHIF / PRIVATE)
  - NHIF card number input field
  - NHIF authorization number field (`nhifAuthNumber`)
  - "Verify NHIF" button
  - Basic validation for NHIF numbers

- ⚠️ **Limitations**:
  - **NHIF verification is SIMULATED** (not real API call)
  - Uses `setTimeout` with random success/failure (80% success rate)
  - No actual NHIF API integration
  - No visit type selection (Normal/Emergency/Referral/Follow-up)
  - No referral number field
  - No authorization status tracking

### 2. **Database Schema**
- ✅ **`patients` table**:
  - `nhif_auth_number` VARCHAR(100) - exists
  - `insurance_type` - supports NHIF
  - `insurance_number` - card number storage
  - `status` - patient workflow status

- ✅ **`bill_items` table**:
  - `is_covered_by_nhif` BOOLEAN - exists
  - Supports NHIF coverage flags

- ✅ **`audit_logs` table** (from security implementation):
  - Exists but not NHIF-specific

- ❌ **Missing Tables**:
  - `visits` table (we have `appointments` but not visits/encounters)
  - `nhif_verifications` table
  - `nhif_token_cache` table

### 3. **NHIF Coverage Calculations**
- ✅ **Location**: `views/OpticalDispensing.tsx`, `views/Pharmacy.tsx`
- ✅ **Features**:
  - NHIF frame allowance calculations
  - NHIF lens coverage calculations
  - NHIF medication coverage flags
  - Coverage deduction in billing

### 4. **Roles & Permissions**
- ✅ **Existing Roles**:
  - `RECEPTIONIST` - Can register patients
  - `BILLING_OFFICER` - Can process payments
  - `OPTOMETRIST` - Can see patients
  - `PHARMACIST` - Can dispense medications
  - `OPTICAL_DISPENSER` - Can dispense optical items
  - `ADMIN` - Full access
  - `MANAGER` - Oversight access

- ❌ **Missing Role**:
  - `CLAIM_OFFICER` - Does not exist

### 5. **Backend API**
- ✅ **Location**: `server/enhanced-api.js`
- ✅ **Features**:
  - Patient CRUD operations
  - Basic validation
  - Authentication/authorization

- ❌ **Missing**:
  - NHIF API proxy endpoint (`/api/nhif/verify`)
  - Token management endpoint
  - No Supabase Edge Functions for NHIF

## ❌ **WHAT WE DON'T HAVE (Required for Full NHIF Module)**

### 1. **NHIF Verification System**
- ❌ **Real NHIF API Integration**:
  - No actual API call to NHIF `AuthorizeCard` endpoint
  - No token management (`/Token` endpoint)
  - No username/password credentials storage
  - No token caching/refresh mechanism

- ❌ **Verification Workflow**:
  - No visit type selection (Normal/Emergency/Referral/Follow-up)
  - No referral number field (required for Referral/Follow-up)
  - No authorization status tracking (ACCEPTED/REJECTED)
  - No authorization number locking to visit
  - No full response JSON storage

### 2. **Database Tables (Missing)**
- ❌ **`visits` table**:
  ```sql
  - id
  - patient_id
  - visit_date
  - department
  - payer_type (CASH / INSURANCE)
  - insurance_provider (NHIF)
  - status (REGISTERED, IN_PROGRESS, COMPLETED, CANCELLED)
  ```

- ❌ **`nhif_verifications` table**:
  ```sql
  - id
  - visit_id (FK)
  - card_no
  - visit_type_id (1-4)
  - referral_no (nullable)
  - remarks_sent (nullable)
  - card_status
  - authorization_status
  - authorization_no (nullable)
  - response_payload (jsonb)
  - verified_by (user_id)
  - verified_at (timestamp)
  - is_active (bool)
  ```

- ❌ **`nhif_token_cache` table**:
  ```sql
  - id
  - access_token
  - token_type
  - expires_at
  - fetched_at
  ```

### 3. **Service Gating Rules**
- ❌ **Hard Blocking**:
  - No blocking of consultation if not verified
  - No blocking of lab orders if not verified
  - No blocking of medication dispensing if not verified
  - No blocking of invoice creation if not verified
  - No enforcement of `AuthorizationStatus=ACCEPTED` before services

- ❌ **Cash Switch Override**:
  - No "convert to CASH" option when rejected
  - No reason capture for cash conversion
  - No audit log for cash conversion

### 4. **UI Components (Missing)**
- ❌ **Verification Result Drawer**:
  - No display of AuthorizationStatus badge
  - No display of AuthorizationNo with copy button
  - No display of CardStatus
  - No display of Member name
  - No display of Remarks

- ❌ **Visit Header Badge**:
  - No "NHIF: VERIFIED (AuthNo ...)" badge
  - No "NHIF: REJECTED" badge
  - No "NHIF: WARNING" badge
  - Not displayed in triage, clinical, labs, pharmacy, cashier views

- ❌ **Admin NHIF Settings**:
  - No facility code/info management
  - No credential store (secure vault)
  - No NHIF logs view
  - No verification history

### 5. **Backend Integration**
- ❌ **Edge Function / API Proxy**:
  - No `POST /nhif/verify` endpoint
  - No token fetch/refresh logic
  - No secure credential storage
  - No NHIF API error handling

- ❌ **Token Management**:
  - No token caching
  - No automatic token refresh on expiry
  - No retry logic on unauthorized errors

### 6. **Operational Reporting**
- ❌ **NHIF Dashboards**:
  - No verification success rate
  - No rejections by reason (Remarks)
  - No "Unknown but accepted" warnings count
  - No re-verifications per day tracking
  - No top staff by verification volume

### 7. **Business Rules**
- ❌ **Visit Type Rules**:
  - No enforcement: Normal = one facility per day
  - No exception: Emergency can verify even if another facility visited
  - No ReferralNo requirement for Referral/Follow-up types
  - No validation of referral number format

- ❌ **Edge Case Handling**:
  - No handling of "Unknown" status with warning
  - No handling of "Invalid" status after warning
  - No guidance for invalid card format
  - No handling of NHIF downtime scenarios

## 📊 **SUMMARY TABLE**

| Feature | Status | Notes |
|---------|--------|-------|
| **NHIF Verification (Real API)** | ❌ Missing | Currently simulated |
| **Visit Type Selection** | ❌ Missing | No Normal/Emergency/Referral/Follow-up |
| **Referral Number Field** | ❌ Missing | Required for Referral/Follow-up |
| **Authorization Status Tracking** | ❌ Missing | No ACCEPTED/REJECTED tracking |
| **Authorization Number Locking** | ❌ Missing | Not locked to visit |
| **Service Gating** | ❌ Missing | No blocking if not verified |
| **Verification Result Display** | ❌ Missing | No UI component |
| **Visit Header Badge** | ❌ Missing | No status indicator |
| **NHIF Settings (Admin)** | ❌ Missing | No configuration panel |
| **Token Management** | ❌ Missing | No token cache/refresh |
| **Edge Function/Proxy** | ❌ Missing | No secure API proxy |
| **NHIF Reports** | ❌ Missing | No operational dashboards |
| **Claim Officer Role** | ❌ Missing | Role doesn't exist |
| **Visits Table** | ❌ Missing | Have appointments, not visits |
| **nhif_verifications Table** | ❌ Missing | No verification history |
| **nhif_token_cache Table** | ❌ Missing | No token storage |
| **Basic NHIF Support** | ✅ Exists | Registration has basic fields |
| **NHIF Coverage Calculations** | ✅ Exists | Optical/Pharmacy have coverage logic |
| **Audit Logs Table** | ✅ Exists | From security implementation |

## 🎯 **IMPLEMENTATION PRIORITY**

### **Phase 1: Core Infrastructure** (Critical)
1. Create `visits` table
2. Create `nhif_verifications` table
3. Create `nhif_token_cache` table
4. Add `CLAIM_OFFICER` role
5. Create Edge Function for NHIF API proxy

### **Phase 2: Verification Workflow** (Critical)
1. Add visit type selection (1-4)
2. Add referral number field
3. Implement real NHIF API integration
4. Implement token management
5. Store authorization results

### **Phase 3: Service Gating** (Critical)
1. Block services if not verified
2. Add cash conversion override
3. Add verification status checks across modules

### **Phase 4: UI Components** (Important)
1. Verification result drawer
2. Visit header badge
3. Admin NHIF settings panel

### **Phase 5: Reporting** (Nice to Have)
1. Verification success rate dashboard
2. Rejection analysis
3. Staff performance metrics

## 🔍 **ROLES CONFIRMATION**

### ✅ **Roles We Have**:
- `ADMIN` (Super Admin)
- `MANAGER` (Clinic Manager)
- `RECEPTIONIST`
- `OPTOMETRIST`
- `PHARMACIST`
- `OPTICAL_DISPENSER`
- `BILLING_OFFICER`

### ❌ **Roles We Don't Have**:
- `CLAIM_OFFICER` - Required for managing referral/follow-up info and resolving "Unknown/Invalid" workflows

## 📝 **CURRENT NHIF VERIFICATION CODE**

**Location**: `views/Registration.tsx` lines 110-134

```typescript
const handleVerifyNHIF = async () => {
  // ... validation ...
  
  // Simulate NHIF validation API call
  setTimeout(() => {
    const isValid = Math.random() > 0.2; // 80% success rate
    
    if (isValid) {
      setIsVerified(true);
      setFormData(prev => ({ ...prev, nhifAuthNumber: generateAuthNumber() }));
      showSuccess('NHIF membership validated successfully!');
    } else {
      setVerificationError('NHIF membership validation failed...');
    }
  }, 2000);
};
```

**This is a SIMULATION, not a real API call.**

---

## ✅ **CONFIRMATION**

**Current State**: Basic NHIF support exists but is **NOT FUNCTIONAL** for production use.

**Missing**: ~90% of required NHIF module functionality.

**Ready to Implement**: Yes, but requires significant development work.

---

**Status**: ⚠️ **PARTIAL IMPLEMENTATION - NOT PRODUCTION READY**
