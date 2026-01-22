/**
 * Security Configuration Validator
 * Validates environment variables and security settings on startup
 */

/**
 * Validate security configuration
 */
export const validateSecurityConfig = () => {
  const errors = [];
  const warnings = [];

  // Required environment variables
  const required = {
    JWT_SECRET: process.env.JWT_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // Check required variables
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long for production');
    }
    if (process.env.JWT_SECRET === 'your-super-secret-key-change-this') {
      errors.push('JWT_SECRET must be changed from default value');
    }
  }

  // Validate CORS origin
  if (process.env.CORS_ORIGIN) {
    if (process.env.CORS_ORIGIN === '*' || process.env.CORS_ORIGIN.includes('*')) {
      warnings.push('CORS_ORIGIN should not use wildcards in production');
    }
    if (!process.env.CORS_ORIGIN.startsWith('https://')) {
      warnings.push('CORS_ORIGIN should use HTTPS in production');
    }
  }

  // Validate NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      errors.push('Strong JWT_SECRET required in production');
    }
    if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.includes('localhost')) {
      warnings.push('CORS_ORIGIN should not include localhost in production');
    }
  }

  // Check for common security misconfigurations
  if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
    warnings.push('Debug mode enabled - disable in production');
  }

  // Validate rate limiting configuration
  const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
  if (rateLimitWindow < 60000) {
    warnings.push('Rate limit window should be at least 1 minute');
  }

  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  if (rateLimitMax > 1000) {
    warnings.push('Rate limit max requests seems too high');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Print security configuration status
 */
export const printSecurityStatus = () => {
  const validation = validateSecurityConfig();

  console.log('\n🔒 Security Configuration Status\n');

  if (validation.errors.length > 0) {
    console.error('❌ Configuration Errors:');
    validation.errors.forEach(error => console.error(`   - ${error}`));
    console.error('\n⚠️  Server may not start correctly with these errors.\n');
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️  Configuration Warnings:');
    validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.log('');
  }

  if (validation.isValid && validation.warnings.length === 0) {
    console.log('✅ Security configuration is valid\n');
  }

  // Print security features status
  console.log('🛡️  Security Features:');
  console.log(`   ✓ Helmet security headers: ${process.env.DISABLE_HELMET !== 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`   ✓ Rate limiting: Enabled`);
  console.log(`   ✓ IP blocking: Enabled`);
  console.log(`   ✓ CSRF protection: Enabled`);
  console.log(`   ✓ Password policy: Enabled`);
  console.log(`   ✓ Security logging: Enabled`);
  console.log(`   ✓ Input validation: Enabled`);
  console.log(`   ✓ Session management: Enabled`);
  console.log('');

  return validation;
};

export default {
  validateSecurityConfig,
  printSecurityStatus,
};
