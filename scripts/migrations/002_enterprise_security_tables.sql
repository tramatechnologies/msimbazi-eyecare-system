-- =============================================================================
-- Enterprise Security Tables Migration
-- Creates tables for IP blocking, CSRF tokens, security events, and password history
-- =============================================================================

-- =============================================================================
-- 1. Blocked IPs table
-- =============================================================================
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL UNIQUE, -- Supports IPv4 and IPv6
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_until ON blocked_ips(blocked_until);

-- =============================================================================
-- 2. CSRF Tokens table
-- =============================================================================
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL, -- SHA256 hash (32 bytes hex = 64 chars)
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user_id ON csrf_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);

-- =============================================================================
-- 3. Security Events table
-- =============================================================================
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);

-- =============================================================================
-- 4. Password History table (if not exists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

-- =============================================================================
-- 5. Enhanced Login Attempts table (if not exists)
-- =============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'login_attempts') THEN
    CREATE TABLE login_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      user_agent TEXT,
      success BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_login_attempts_email ON login_attempts(email);
    CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
    CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at);
    CREATE INDEX idx_login_attempts_success ON login_attempts(success);
  END IF;
END $$;

-- =============================================================================
-- 6. User Security Settings table
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  password_changed_at TIMESTAMPTZ,
  last_password_change TIMESTAMPTZ,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  mfa_backup_codes TEXT[], -- Array of backup codes
  failed_mfa_attempts INTEGER DEFAULT 0,
  account_locked BOOLEAN DEFAULT FALSE,
  account_locked_until TIMESTAMPTZ,
  last_login_ip VARCHAR(45),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_settings_account_locked ON user_security_settings(account_locked);

-- =============================================================================
-- 7. User Sessions table (create if not exists, then enhance)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Add additional columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'last_activity') THEN
    ALTER TABLE user_sessions ADD COLUMN last_activity TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'device_info') THEN
    ALTER TABLE user_sessions ADD COLUMN device_info JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'location') THEN
    ALTER TABLE user_sessions ADD COLUMN location VARCHAR(255);
  END IF;
END $$;

-- =============================================================================
-- 8. Cleanup function for expired records
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_security_records()
RETURNS void AS $$
BEGIN
  -- Delete expired CSRF tokens
  DELETE FROM csrf_tokens WHERE expires_at < NOW();
  
  -- Delete expired blocked IPs
  DELETE FROM blocked_ips WHERE blocked_until < NOW();
  
  -- Delete old password history (keep last 5)
  DELETE FROM password_history
  WHERE id NOT IN (
    SELECT id FROM password_history
    WHERE user_id = password_history.user_id
    ORDER BY created_at DESC
    LIMIT 5
  );
  
  -- Archive old security events (older than 1 year)
  -- In production, you might want to move these to an archive table
  DELETE FROM security_events 
  WHERE timestamp < NOW() - INTERVAL '1 year' 
  AND resolved = TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. Create scheduled job (requires pg_cron extension)
-- =============================================================================
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-security-records', '0 2 * * *', 'SELECT cleanup_expired_security_records();');

-- =============================================================================
-- 10. Row Level Security Policies
-- =============================================================================

-- Security events: Only admins can view
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_events_admin_only ON security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'clinic_manager')
    )
  );

-- Blocked IPs: Only admins can view/manage
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocked_ips_admin_only ON blocked_ips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'clinic_manager')
    )
  );

-- CSRF tokens: Users can only see their own
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY csrf_tokens_user_own ON csrf_tokens
  FOR ALL
  USING (user_id = auth.uid());

-- Password history: Users can only see their own
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY password_history_user_own ON password_history
  FOR SELECT
  USING (user_id = auth.uid());

-- User security settings: Users can only see their own
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_security_settings_user_own ON user_security_settings
  FOR ALL
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'clinic_manager')
    )
  );

-- User sessions: Users can only see their own sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_sessions_user_own ON user_sessions
  FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE blocked_ips IS 'Tracks blocked IP addresses for security';
COMMENT ON TABLE csrf_tokens IS 'CSRF token storage for state-changing operations';
COMMENT ON TABLE security_events IS 'Security event logging and monitoring';
COMMENT ON TABLE password_history IS 'Password change history for policy enforcement';
COMMENT ON TABLE user_security_settings IS 'User-specific security settings and MFA configuration';
COMMENT ON TABLE user_sessions IS 'User session management with token hashing and expiration';
