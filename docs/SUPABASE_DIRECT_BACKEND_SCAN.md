# Supabase Direct Backend – Migration Scan

This document lists **everything that must change** when using **direct Supabase as backend** (no Express API on `localhost:3001`).

---

## ✅ Already Using Supabase Directly

| Area | Location | Notes |
|------|----------|--------|
| **Auth** | `contexts/AuthContext.tsx` | Supabase Auth (`signInWithPassword`, `getSession`, etc.). Optional API login fallback when `VITE_API_URL` set. |
| **Providers** | `services/providerService.ts` | Fetches from `providers` via `supabaseClient`. |
| **Medications** | `services/medicationService.ts` | Fetches from `medications` via `supabaseClient`. |
| **ICD-10** | `services/icd10Service.ts` | Fetches from `icd10_codes` via `supabaseClient`. |
| **Doctor dropdown** | `views/Registration.tsx` | Uses `getProvidersForScheduling()` – all OPTOMETRIST + OPHTHALMOLOGIST, any status. |

---

## 🔄 Must Switch from API to Supabase

### 1. **Patients** ✅ Implemented

| Current | Target |
|--------|--------|
| `services/patientService.ts` | Use Supabase client for all patient CRUD. |
| `contexts/PatientContext.tsx` | Use **Supabase configured** (not `VITE_API_URL` + `authToken`) to decide “remote” vs localStorage. |

**API usage to replace:**

- `POST /api/patients` → `supabase.from('patients').insert(...)`
- `GET /api/patients/:id` → `supabase.from('patients').select().eq('id', id)` + prescriptions, bill_items
- `PUT /api/patients/:id` → `supabase.from('patients').update(...).eq('id', id)`
- `GET /api/patients` (list) → `supabase.from('patients').select(...)` with filters/pagination
- `DELETE /api/patients/:id` → soft delete (e.g. `deleted_at`)

Also used by patientService (can be done later or via Supabase):

- Prescriptions: `prescriptions` table
- Bill items: `bill_items` table

**Note:** `isApiAvailable()` in `patientService` checks `authToken` + `VITE_API_URL`. For direct Supabase, use `isSupabaseConfigured()` and Supabase-backed implementations instead.

---

### 2. **Audit logs** (Medium priority)

| Current | Target |
|--------|--------|
| `services/auditLogService.ts` | `POST /api/audit-logs/log` |
| `services/auditService.ts` | `GET /api/audit-logs`, `GET /api/audit-logs/users` |

**Change:** Call `supabase.from('audit_logs').insert(...)` and `supabase.from('audit_logs').select(...)` directly. Ensure RLS allows the right roles to read/write.

---

### 3. **NHIF** (Higher complexity)

| Current | Target |
|--------|--------|
| `services/nhifService.ts` | Verify, visits, convert-to-cash |
| `views/NHIFSettings.tsx` | Config load/save, test-connection |

**API usage:**

- `POST /api/nhif/verify` – calls external NHIF API + stores verification
- `GET /api/nhif/verification/:visitId`
- `POST /api/visits`, `GET /api/visits/:id`, `GET /api/visits/patient/:patientId`
- `POST /api/visits/:id/convert-to-cash`
- `GET /api/nhif/config`, `POST /api/nhif/config`, `POST /api/nhif/test-connection`

**Options:**

- **Supabase Edge Functions** for verify, visits, convert-to-cash, and config, each calling NHIF API and reading/writing Supabase.
- Or keep a **minimal Node API** only for NHIF (+ Gemini if desired).

---

### 4. **Gemini / Clinical AI** (Backend required)

| Current | Target |
|--------|--------|
| `services/geminiService.ts` | `POST /api/clinical/ai-*` (insights, diagnosis, ICD-10, treatment, medications) |

**Why:** API keys must stay server-side. **Options:**

- Keep a **small Express API** (or another backend) only for these routes.
- Or move to **Supabase Edge Functions** that call Gemini and use env secrets.

---

### 5. **AuthContext API login fallback**

| Current | Target |
|--------|--------|
| `contexts/AuthContext.tsx` | Tries `POST /api/auth/login` when `VITE_API_URL` set |

**Change:** When using **only** Supabase:

- Remove or disable the API login path.
- Use **only** Supabase Auth (`signInWithPassword`). No `authToken` / API logout.

---

## 📋 Summary Table

| Component | Uses API? | Switch to Supabase? | Notes |
|-----------|-----------|---------------------|--------|
| Auth | Supabase Auth + optional API login | Disable API login when direct Supabase | ✅ |
| Providers | No (Supabase) | ✅ Done | |
| Medications | No (Supabase) | ✅ Done | |
| ICD-10 | No (Supabase) | ✅ Done | |
| Doctor dropdown | No (Supabase) | ✅ Done | `getProvidersForScheduling` |
| **Patients** | No (Supabase) | ✅ Done | patientService + PatientContext |
| Audit logs | Yes | Yes | auditLogService, auditService |
| NHIF | Yes | Edge Functions or keep small API | External NHIF API |
| Gemini AI | Yes | Edge Functions or keep small API | Keys server-side only |

---

## 🔧 Env / Config

**Direct Supabase only:**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Not needed for core app:**

- `VITE_API_URL` (unless you keep NHIF/Gemini API)

**Backend-only (if you keep any API):**

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, etc.

---

## ✅ Doctor Dropdown Fix (Done)

**Issue:** Admin-added doctors did not appear in “Assign Doctor” during scheduling.

**Cause:** Registration used `getAvailableProviders('OPTOMETRIST')`, which filters by `status === 'AVAILABLE' \|\| 'ON_BREAK'`. Doctors with `OFFLINE` / `BUSY` (or other roles) were excluded.

**Change:**

- Added `getProvidersForScheduling()` in `providerService`: fetches all active providers with `role` in `['OPTOMETRIST','OPHTHALMOLOGIST']`, **no status filter**.
- Registration uses `getProvidersForScheduling()` instead of `getAvailableProviders('OPTOMETRIST')`.
- Dropdown label: `{doctor.name} – {doctor.specialization || doctor.role}` to avoid “undefined”.

All doctors from Supabase now appear in the dropdown.
