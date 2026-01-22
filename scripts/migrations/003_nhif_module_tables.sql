-- Migration: NHIF Module Tables
-- Creates tables for NHIF verification, visits, and token management
-- Run in Supabase SQL Editor or via: psql ... -f 003_nhif_module_tables.sql

-- =============================================================================
-- 1. Visits Table (Encounter/Visit tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_time TIME NOT NULL DEFAULT CURRENT_TIME,
  department VARCHAR(100) NOT NULL DEFAULT 'OPTOMETRY',
  payer_type VARCHAR(50) NOT NULL CHECK (payer_type IN ('CASH', 'INSURANCE')),
  insurance_provider VARCHAR(100), -- NHIF, Britam, etc.
  status VARCHAR(50) NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for visits
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_payer_type ON visits(payer_type);

-- Add comment
COMMENT ON TABLE visits IS 'Patient visits/encounters - tracks each patient visit session';

-- =============================================================================
-- 2. NHIF Verifications Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS nhif_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  card_no VARCHAR(50) NOT NULL,
  visit_type_id INTEGER NOT NULL CHECK (visit_type_id IN (1, 2, 3, 4)), -- 1=Normal, 2=Emergency, 3=Referral, 4=Follow-up
  referral_no VARCHAR(100), -- Required for Referral (3) and Follow-up (4)
  remarks_sent TEXT, -- Optional remarks sent to NHIF API
  card_status VARCHAR(50), -- ACTIVE, INACTIVE, NOT_FOUND, etc.
  authorization_status VARCHAR(50) NOT NULL CHECK (authorization_status IN ('ACCEPTED', 'REJECTED', 'PENDING', 'UNKNOWN', 'INVALID')),
  authorization_no VARCHAR(100), -- Only if ACCEPTED
  member_name VARCHAR(255), -- If provided by NHIF response
  response_payload JSONB, -- Full NHIF API response
  verified_by UUID NOT NULL REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE, -- Only one active verification per visit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for nhif_verifications
CREATE INDEX IF NOT EXISTS idx_nhif_verifications_visit_id ON nhif_verifications(visit_id);
CREATE INDEX IF NOT EXISTS idx_nhif_verifications_card_no ON nhif_verifications(card_no);
CREATE INDEX IF NOT EXISTS idx_nhif_verifications_authorization_status ON nhif_verifications(authorization_status);
CREATE INDEX IF NOT EXISTS idx_nhif_verifications_verified_at ON nhif_verifications(verified_at);
CREATE INDEX IF NOT EXISTS idx_nhif_verifications_is_active ON nhif_verifications(visit_id, is_active) WHERE is_active = TRUE;

-- Unique constraint: only one active verification per visit
CREATE UNIQUE INDEX IF NOT EXISTS idx_nhif_verifications_unique_active 
ON nhif_verifications(visit_id) 
WHERE is_active = TRUE;

-- Add comment
COMMENT ON TABLE nhif_verifications IS 'NHIF card verification results - one-to-many with visits, but typically one active per visit';

-- =============================================================================
-- 3. NHIF Token Cache Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS nhif_token_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active token lookup
CREATE INDEX IF NOT EXISTS idx_nhif_token_cache_expires_at ON nhif_token_cache(expires_at);

-- Add comment
COMMENT ON TABLE nhif_token_cache IS 'Cached NHIF API access tokens - only one active token should exist';

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_nhif_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM nhif_token_cache 
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. NHIF Facility Configuration Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS nhif_facility_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_code VARCHAR(100) UNIQUE,
  facility_name VARCHAR(255),
  nhif_username VARCHAR(255), -- Encrypted in production
  nhif_password TEXT, -- Encrypted in production
  nhif_api_url VARCHAR(500) DEFAULT 'https://api.nhif.go.tz', -- Default NHIF API URL
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Add comment
COMMENT ON TABLE nhif_facility_config IS 'NHIF facility configuration and credentials - should be encrypted in production';

-- =============================================================================
-- 5. RLS Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhif_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhif_token_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhif_facility_config ENABLE ROW LEVEL SECURITY;

-- Visits: Receptionist can create, all authenticated can read their department's visits
CREATE POLICY "Receptionist can create visits"
  ON visits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('receptionist', 'super_admin')
    )
  );

CREATE POLICY "Users can view visits"
  ON visits FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can view visits

CREATE POLICY "Staff can update visits"
  ON visits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('receptionist', 'optometrist', 'pharmacist', 'optical_dispenser', 'billing_officer', 'super_admin', 'clinic_manager')
    )
  );

-- NHIF Verifications: Receptionist can create, all can read, admin can update
CREATE POLICY "Receptionist can create NHIF verifications"
  ON nhif_verifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('receptionist', 'super_admin', 'clinic_manager')
    )
  );

CREATE POLICY "Users can view NHIF verifications"
  ON nhif_verifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can update NHIF verifications"
  ON nhif_verifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'clinic_manager')
    )
  );

-- NHIF Token Cache: Only system/service role can access
CREATE POLICY "Service role can manage tokens"
  ON nhif_token_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- NHIF Facility Config: Only admin can access
CREATE POLICY "Admin can manage NHIF config"
  ON nhif_facility_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
    )
  );

-- =============================================================================
-- 6. Helper Functions
-- =============================================================================

-- Function to get active NHIF verification for a visit
CREATE OR REPLACE FUNCTION get_active_nhif_verification(p_visit_id UUID)
RETURNS TABLE (
  id UUID,
  visit_id UUID,
  card_no VARCHAR,
  visit_type_id INTEGER,
  referral_no VARCHAR,
  authorization_status VARCHAR,
  authorization_no VARCHAR,
  member_name VARCHAR,
  verified_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nv.id,
    nv.visit_id,
    nv.card_no,
    nv.visit_type_id,
    nv.referral_no,
    nv.authorization_status,
    nv.authorization_no,
    nv.member_name,
    nv.verified_at
  FROM nhif_verifications nv
  WHERE nv.visit_id = p_visit_id
    AND nv.is_active = TRUE
  ORDER BY nv.verified_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to deactivate old verifications when new one is created
CREATE OR REPLACE FUNCTION deactivate_old_nhif_verifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate all other verifications for this visit
  UPDATE nhif_verifications
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE visit_id = NEW.visit_id
    AND id != NEW.id
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-deactivate old verifications
CREATE TRIGGER trigger_deactivate_old_nhif_verifications
  AFTER INSERT ON nhif_verifications
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION deactivate_old_nhif_verifications();

-- =============================================================================
-- 7. Audit Log Enhancement (add NHIF-specific actions)
-- =============================================================================
-- Note: audit_logs table already exists from security migration
-- This just documents the NHIF-specific action types

-- NHIF-specific action types to use in audit_logs:
-- 'NHIF_VERIFY' - NHIF verification performed
-- 'NHIF_TOKEN_REFRESH' - NHIF token refreshed
-- 'NHIF_OVERRIDE_ATTEMPT' - Attempt to override verification (blocked)
-- 'NHIF_CASH_CONVERSION' - Visit converted from NHIF to CASH
-- 'NHIF_RE_VERIFY' - Re-verification performed

COMMENT ON TABLE audit_logs IS 'Audit logs support NHIF actions: NHIF_VERIFY, NHIF_TOKEN_REFRESH, NHIF_OVERRIDE_ATTEMPT, NHIF_CASH_CONVERSION, NHIF_RE_VERIFY';
