-- Migration: EMR tables and patients extensions
-- Run in Supabase SQL Editor or via: psql ... -f 001_emr_tables_and_patients_extensions.sql
-- Supports: Clinical EMR, Registration, Billing, Pharmacy, Optical Dispensing

-- =============================================================================
-- 1. Extend patients table with EMR & workflow columns
-- =============================================================================
-- Add columns if not present (safe to run multiple times with IF NOT EXISTS logic)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'status') THEN
    ALTER TABLE patients ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'WAITING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'checked_in_at') THEN
    ALTER TABLE patients ADD COLUMN checked_in_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'assigned_provider_id') THEN
    ALTER TABLE patients ADD COLUMN assigned_provider_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'chief_complaint') THEN
    ALTER TABLE patients ADD COLUMN chief_complaint TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'clinical_notes') THEN
    ALTER TABLE patients ADD COLUMN clinical_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'consultation_notes') THEN
    ALTER TABLE patients ADD COLUMN consultation_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'ophthalmologist_notes') THEN
    ALTER TABLE patients ADD COLUMN ophthalmologist_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'diagnosis') THEN
    ALTER TABLE patients ADD COLUMN diagnosis TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'appointment') THEN
    ALTER TABLE patients ADD COLUMN appointment JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'nhif_auth_number') THEN
    ALTER TABLE patients ADD COLUMN nhif_auth_number VARCHAR(100);
  END IF;
END $$;

-- Index for status filtering (queue, dashboards)
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_checked_in_at ON patients(checked_in_at);

-- =============================================================================
-- 2. Prescriptions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  od VARCHAR(100),
  os VARCHAR(100),
  add_od VARCHAR(100),
  add_os VARCHAR(100),
  edge_color VARCHAR(50),
  sphere_od VARCHAR(50),
  sphere_os VARCHAR(50),
  cylinder_od VARCHAR(50),
  cylinder_os VARCHAR(50),
  axis_od VARCHAR(50),
  axis_os VARCHAR(50),
  prism_od VARCHAR(50),
  prism_os VARCHAR(50),
  base_od VARCHAR(50),
  base_os VARCHAR(50),
  pupillary_distance VARCHAR(50),
  segment_height VARCHAR(50),
  lens_type VARCHAR(100),
  medications JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at);

-- =============================================================================
-- 3. Bill items table
-- =============================================================================
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  external_id VARCHAR(100) UNIQUE,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  category VARCHAR(50) NOT NULL CHECK (category IN ('CLINICAL', 'PHARMACY', 'OPTICAL')),
  is_covered_by_nhif BOOLEAN DEFAULT FALSE,
  is_covered_by_private BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_bill_items_patient_id ON bill_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_category ON bill_items(category);

-- =============================================================================
-- 4. Appointments table (optional; can also store as JSONB on patients)
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_type VARCHAR(100) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  priority VARCHAR(50) DEFAULT 'Normal',
  assigned_doctor_id UUID REFERENCES auth.users(id),
  assigned_department VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- =============================================================================
-- 5. Soft delete support on patients (optional)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'deleted_at') THEN
    ALTER TABLE patients ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patients_deleted_at ON patients(deleted_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- 6. RLS (optional)
-- =============================================================================
-- Enable RLS on new tables. Configure policies per your auth setup.
-- The enhanced-api uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- See BACKEND_IMPLEMENTATION.md for role-based access.
