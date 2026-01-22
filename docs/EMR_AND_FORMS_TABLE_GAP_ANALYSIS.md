# EMR & Forms ↔ Database Tables Gap Analysis

This document confirms whether all tables required by the **EMR form** (Optometrist dashboard), **Registration**, **Billing**, **Pharmacy**, and **Optical Dispensing** forms exist in the database and are supported by the backend API.

---

## 1. Data Flow Summary

| Source | Storage | API |
|--------|---------|-----|
| **Clinical EMR**, **Registration**, **Appointments**, **Queue** | `PatientContext` → `localStorage` (`msimbazi_patients`) | Not used for add/update |
| **Billing**, **Pharmacy**, **Optical Dispensing** | Read from `PatientContext`; some status/billing updates via `patientService` → backend | `PUT /api/patients/:id` (limited fields) |

The app currently uses **localStorage** as the primary store for patient + EMR + prescriptions + bill items. The **enhanced-api** backend uses **Supabase** (`patients` table and auth-related tables) but does **not** persist EMR, prescriptions, or bill items.

---

## 2. Forms and Their Data Requirements

### 2.1 Clinical EMR (Optometrist Dashboard)

**View:** `views/Clinical.tsx`  
**Roles:** Optometrist, Admin  

**Form sections and fields:**

| Section | Fields | Logical storage |
|---------|--------|------------------|
| **History** | chiefComplaint, historyPresentIllness, pastOcularHistory, familyHistory, medications, allergies, socialHistory, systemicHistory | `patients` or `clinical_notes` |
| **Examination – Visual Acuity** | visualAcuityDistanceOD/OS, visualAcuityNearOD/OS, visualAcuityPinholeOD/OS | `patients.consultation_notes` (concatenated) or `examinations` |
| **Examination – Refraction** | refractionOD, refractionOS, addOD, addOS | `prescriptions` (od, os, addOd, addOs) |
| **Examination – Other** | pupils, pupilSizeOD/OS, pupilReactivityOD/OS, extraocularMovements, anteriorSegment, posteriorSegment, intraocularPressureOD/OS, tonometryMethod, isDilated, slitLampFindings | `patients.consultation_notes` or `examinations` |
| **Additional tests** | visualField, colorVision, coverTest, stereopsis, accommodation, convergence | same |
| **Assessment & plan** | diagnosis, icd10Code, plan, followUp | `patients.diagnosis`; plan/followUp in notes |
| **Prescription** | prescriptionOD/OS, prescriptionAddOD/OS, sphereOD/OS, cylinderOD/OS, axisOD/OS, prismOD/OS, baseOD/OS, pupillaryDistance, segmentHeight, lensType | `prescriptions` |
| **Medications** | medicationPrescriptions[] (name, strength, dosage, frequency, duration, route, instructions) | `prescriptions.medications` |
| **Billing** | Adds "Comprehensive Eye Examination Fee" | `bill_items` |

**On “Complete”:** `updatePatient` (PatientContext) receives:

- `status`, `chiefComplaint`, `clinicalNotes`, `consultationNotes`, `diagnosis`
- `prescription`: od, os, addOd, addOs, sphereOD/OS, cylinderOD/OS, axisOD/OS, prismOD/OS, baseOD/OS, pupillaryDistance, segmentHeight, lensType, medications[]
- `billItems`: existing + new exam fee

**Tables required for full EMR support:**

- **patients:** `chief_complaint`, `clinical_notes`, `consultation_notes`, `diagnosis`, `status`, `assigned_provider_id`, etc.
- **prescriptions:** `patient_id`, od, os, add_od, add_os, sphere/cylinder/axis/prism/base OD/OS, PD, segment_height, lens_type, `medications` (JSONB or related table), timestamps.
- **bill_items:** `patient_id`, `description`, `amount`, `category`, `is_covered_by_nhif`, `is_covered_by_private`, etc.
- **examinations** (optional): VA, IOP, slit lamp, etc., if not folded into `consultation_notes`.

---

### 2.2 Registration (Receptionist)

**View:** `views/Registration.tsx`  
**Roles:** Receptionist, Admin  

**Form fields:** name, phone, dob, address, gender, patientCategory (CASH/INSURANCE), insuranceProvider, insuranceNumber, nhifAuthNumber, appointmentType, appointmentDate, appointmentTime, priority, assignedDoctorId, selectedServices (billing).

**Stored as:** `addPatient` / `updatePatient` (PatientContext) → Patient object with `appointment`, `billItems` (for CASH), `insurance*`, etc.

**Tables required:**

- **patients:** name, phone, dob, address, gender, insurance_type, insurance_provider, insurance_number, nhif_auth_number, status, checked_in_at, etc.
- **appointments:** id, patient_id, type, date, time, priority, assigned_doctor_id, status (or embed in patients as JSON).
- **bill_items:** when CASH + selected services.

---

### 2.3 Billing (Billing Officer)

**View:** `views/Billing.tsx`  

**Reads:** `patients`, `patient.billItems`, `patient.insuranceType` (for coverage).  
**Writes:** `updatePatient(..., { status: COMPLETED })` via `patientService`.

**Tables required:** **patients** (status, bill items, insurance), **bill_items** (linked to patient).

---

### 2.4 Pharmacy (Pharmacist)

**View:** `views/Pharmacy.tsx`  

**Reads:** `patients`, `patient.prescription.medications`, `patient.billItems`.  
**Writes:** `patientService.updatePatient` with `status`, `billItems` (adds pharmacy items).

**Tables required:** **patients**, **prescriptions** (medications), **bill_items**.

---

### 2.5 Optical Dispensing (Optical Dispenser)

**View:** `views/OpticalDispensing.tsx`  

**Reads:** `patients`, `patient.prescription` (od, os, addOd, addOs, edgeColor).  
**Writes:** `patientService.updatePatient` with `prescription` (frame/lens details), `billItems` (frame + lenses).

**Tables required:** **patients**, **prescriptions**, **bill_items**.

---

## 3. Current Database Tables (Backend / Supabase)

From `server/enhanced-api.js`, `server/auth.js`, `server/validation.js`, `BACKEND_IMPLEMENTATION.md`, and `scripts/assign-super-admin.sql`:

| Table | Purpose | Used in API |
|-------|---------|-------------|
| **patients** | Demographics, insurance, registration | POST/GET/PUT /api/patients |
| **profiles** | User profile (e.g. last login) | Auth |
| **user_roles** | User ↔ role mapping | Auth, RBAC |
| **role_permissions** | Role ↔ permissions | Auth |
| **user_sessions** | Active sessions, token revoke | Auth |
| **login_attempts** | Rate limiting, lockout | Auth |
| **audit_logs** | Audit trail | Auth |
| **validation_rules** | Dynamic validation | validation.js |
| **encryption_keys**, **encrypted_fields**, **password_history** | Security (doc-only) | — |

**`patients` columns used in enhanced-api:**

- **Insert (POST):** `patient_number`, `name`, `phone`, `email`, `dob`, `gender`, `address`, `insurance_type`, `insurance_provider`, `insurance_policy_number`, `insurance_member_number`, `created_by`, `registered_by`.
- **Update (PUT):** `name`, `phone`, `email`, `gender`, `address`, `insurance_type`, `insurance_provider`, `insurance_policy_number`, `updated_by`, `updated_at`.

**Not stored in backend `patients`:**  
`status`, `chief_complaint`, `clinical_notes`, `consultation_notes`, `diagnosis`, `prescription`, `bill_items`, `appointment`, `checked_in_at`, `assigned_provider_id`, etc.

**Other tables:**

- **prescriptions:** Mentioned in BACKEND_IMPLEMENTATION (RLS) but **no** prescriptions API routes in `enhanced-api.js`.
- **bill_items:** Same—referenced in docs, **no** bill-items API routes.

---

## 4. API Endpoints vs Forms

| Endpoint | Exists | Used by | Supports EMR / Forms? |
|----------|--------|---------|------------------------|
| `POST /api/patients` | ✓ | Registration (if wired to API) | Partial: demographics + insurance only |
| `GET /api/patients` | ✓ | List/search | No EMR, prescriptions, bill items |
| `GET /api/patients/:id` | ✓ | Get patient | No EMR, prescriptions, bill items |
| `PUT /api/patients/:id` | ✓ | Billing, Pharmacy, Optical (via patientService) | No EMR, prescriptions, bill items; only demographics + insurance |
| `POST /api/patients/:id/prescriptions` | ✗ | patientService | **Missing** |
| `POST /api/patients/:id/bill-items` | ✗ | patientService | **Missing** |
| `GET /api/patients/:id/prescriptions/history` | ✗ | patientService | **Missing** |
| `GET /api/patients/:id/billing` | ✗ | patientService | **Missing** |
| `DELETE /api/patients/:id` | ✗ | patientService | **Missing** |

---

## 5. Gap Summary

### 5.1 Missing tables for EMR and other forms

| Table | Required by | Status |
|-------|-------------|--------|
| **prescriptions** | EMR, Pharmacy, Optical | **Missing** in implementation (only in docs) |
| **bill_items** | EMR, Registration, Billing, Pharmacy, Optical | **Missing** in implementation (only in docs) |
| **appointments** (or equivalent) | Registration, Appointments | **Missing**; currently embedded in Patient |
| **examinations** (optional) | EMR | **Missing**; could stay in `consultation_notes` |

### 5.2 Missing columns on `patients`

For full EMR + workflow support, `patients` would need (in addition to what exists):

- `status`
- `checked_in_at`
- `assigned_provider_id` / `assigned_optometrist`
- `chief_complaint`
- `clinical_notes`
- `consultation_notes`
- `ophthalmologist_notes`
- `diagnosis`
- `appointment` (JSONB) or FK to **appointments**
- `prescription` (JSONB) or FK to **prescriptions** (prefer separate table).

### 5.3 Missing API endpoints

- `POST /api/patients/:id/prescriptions`
- `GET /api/patients/:id/prescriptions` (and history)
- `POST /api/patients/:id/bill-items`
- `GET /api/patients/:id/billing`
- `DELETE /api/patients/:id` (soft delete)
- PUT **patients** must be extended to accept and persist EMR-related fields (or explicit EMR-specific endpoints).

### 5.4 Form ↔ backend disconnect

- **Clinical EMR** uses **PatientContext** only (localStorage). No EMR data is sent to or stored in Supabase.
- **Registration** uses **PatientContext**; if it used the API, only basic registration fields would be persisted.
- **Billing / Pharmacy / Optical** use **patientService** for some updates, but the backend does not store prescriptions or bill items, so those updates are not persisted in the DB.

---

## 6. Conclusion

**Do we have all tables required by the EMR form and other role-based forms?**

**No.**

- **EMR (Optometrist):** Requires **patients** (with EMR-related columns), **prescriptions**, and **bill_items**. The backend **patients** table lacks EMR fields; **prescriptions** and **bill_items** are not implemented. EMR data exists only in localStorage.
- **Registration:** Needs **patients** (with full registration + appointment + billing info) and **bill_items**. Partially supported by **patients**; **bill_items** and **appointments** are missing.
- **Billing, Pharmacy, Optical:** Depend on **patients**, **prescriptions**, and **bill_items**. Same gaps as above.

**Current state:**  
The UI and forms work because **PatientContext** + **localStorage** hold the full Patient model (including EMR, prescriptions, bill items). The Supabase backend only stores a subset of registration-style data and does not support EMR, prescriptions, or bill items.

---

## 7. Recommendations

1. **Add `prescriptions` table** (and optionally `prescription_medications`) and implement `POST/GET /api/patients/:id/prescriptions` (and history).
2. **Add `bill_items` table** linked to `patients` and implement `POST/GET /api/patients/:id/bill-items` and `GET /api/patients/:id/billing`.
3. **Extend `patients`** with `status`, `checked_in_at`, `assigned_provider_id`, `chief_complaint`, `clinical_notes`, `consultation_notes`, `diagnosis`, and optionally `appointment` (JSONB) or an **appointments** table.
4. **Extend `PUT /api/patients/:id`** (or add dedicated EMR endpoints) to accept and persist EMR-related fields, and ensure the frontend sends them when using the API.
5. **Unify data flow:** Either persist everything via the API (and load from API into PatientContext) or clearly document that the app runs in “local-only” mode. Today it is a hybrid: some views use the API, but EMR and related data never reach the database.

Once these changes are in place, the database will have the tables and columns required by the EMR form and all other role-based forms.

---

## 8. Implementation status (follow-up)

The following has been implemented to address the gaps above:

### 8.1 Migrations

- **`scripts/migrations/001_emr_tables_and_patients_extensions.sql`**
  - New columns on **patients**: `status`, `checked_in_at`, `assigned_provider_id`, `chief_complaint`, `clinical_notes`, `consultation_notes`, `ophthalmologist_notes`, `diagnosis`, `appointment` (JSONB), `nhif_auth_number`, `deleted_at`.
  - New tables: **`prescriptions`**, **`bill_items`**, **`appointments`**.
  - Indexes for status, lookups, and soft delete.

Run this migration in the Supabase SQL Editor (or via `supabase db push`) before using the new API behaviour.

### 8.2 API changes (`server/enhanced-api.js`)

- **PUT /api/patients/:id**  
  - Supports partial updates and EMR fields: `status`, `chiefComplaint`, `clinicalNotes`, `consultationNotes`, `diagnosis`, `appointment`, `prescription`, `billItems`.  
  - Allowed roles: receptionist, super_admin, clinic_manager, optometrist, pharmacist, optical_dispenser, billing_officer.  
  - When `prescription` is sent, a row is inserted into **prescriptions**.  
  - When `billItems` is sent, existing **bill_items** for the patient are replaced with the provided list.

- **GET /api/patients/:id**  
  - Returns patient with latest **prescription**, all **bill_items**, and **prescriptionHistory** (previous prescriptions).  
  - Response shape matches frontend `Patient` (camelCase).

- **POST /api/patients/:id/prescriptions**  
  - Creates a prescription for the patient.

- **GET /api/patients/:id/prescriptions**  
  - Returns prescription history for the patient.

- **GET /api/patients/:id/prescriptions/history**  
  - Same as above (alias for `patientService.getPrescriptionHistory`).

- **POST /api/patients/:id/bill-items**  
  - Adds one or more bill items.  
  - Body: single object or `{ billItems: [...] }` or array.

- **GET /api/patients/:id/billing**  
  - Returns `{ patientId, billItems, total }`.

- **DELETE /api/patients/:id**  
  - Soft-deletes the patient (`deleted_at` set).  
  - Allowed roles: receptionist, super_admin, clinic_manager.

### 8.3 Validation (`server/validation.js`)

- **`validatePatientPartial`**  
  - Used for PUT partial/EMR updates.  
  - Validates only provided fields; no required fields.

### 8.4 Frontend API mode (`PatientContext` + views)

- **PatientContext** uses the API when **`sessionStorage.authToken`** and **`VITE_API_URL`** are set.
  - **Load:** fetches `listPatients` from API; otherwise loads from `localStorage`.
  - **addPatient / updatePatient / deletePatient:** call API when `useApi` is true; otherwise local only.
- **`refreshPatient(id)`** fetches full patient details (including prescription, bill items) from `GET /api/patients/:id` and updates context state.
- **Clinical** calls `refreshPatient` when `useApi` and a patient is selected (e.g. opening EMR from Appointments).
- **Billing, Pharmacy, Optical** use context `updatePatient` instead of `patientService` directly, so updates go through the API when in API mode.

**Enabling API mode:** store the backend JWT as `sessionStorage.setItem('authToken', accessToken)` after logging in via `POST /api/auth/login`. The app currently uses Supabase Auth for login; to use API persistence, you need a flow that calls the enhanced-api login and stores the returned `accessToken` as `authToken`.

### 8.5 Next steps

1. Run **`scripts/migrations/001_emr_tables_and_patients_extensions.sql`** in Supabase.
2. Ensure **`VITE_API_URL`** is set and **`authToken`** is stored after backend login (see 8.4) to enable API-backed persistence.
