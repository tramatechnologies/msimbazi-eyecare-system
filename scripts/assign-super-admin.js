/**
 * Script to assign super_admin role to a user
 * 
 * Usage options:
 * 1. Run SQL directly in Supabase: Use scripts/assign-super-admin.sql
 * 2. Run this script: npm run assign-super-admin
 * 
 * Make sure your .env file has:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase configuration in .env file');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nAlternatively, you can run the SQL script directly in Supabase:');
  console.error('  scripts/assign-super-admin.sql');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = '6ec25daf-c53d-45a4-b322-c02707e8d861';
const ROLE = 'super_admin';

async function assignSuperAdminRole() {
  try {
    console.log(`Assigning ${ROLE} role to user: ${USER_ID}`);
    console.log('Connecting to Supabase...\n');

    // Check if user_roles table exists and if user has a role entry
    const { data: existingRole, error: checkError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', USER_ID)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing role:', checkError);
      return;
    }

    if (existingRole) {
      // Update existing role
      console.log(`Updating existing role from "${existingRole.role}" to "${ROLE}"`);
      
      const { data, error } = await supabase
        .from('user_roles')
        .update({ role: ROLE })
        .eq('user_id', USER_ID)
        .select();

      if (error) {
        console.error('Error updating role:', error);
        return;
      }

      console.log('✅ Successfully updated user role to super_admin');
      console.log('Updated record:', data);
    } else {
      // Insert new role
      console.log('Creating new role entry...');
      
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_id: USER_ID,
          role: ROLE,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.error('Error inserting role:', error);
        return;
      }

      console.log('✅ Successfully assigned super_admin role to user');
      console.log('Created record:', data);
    }

    // Verify the update
    const { data: verifiedRole, error: verifyError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', USER_ID)
      .single();

    if (verifyError) {
      console.error('Error verifying role:', verifyError);
      return;
    }

    console.log('\n✅ Verification successful!');
    console.log('Current role:', verifiedRole.role);
    console.log('User ID:', verifiedRole.user_id);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
assignSuperAdminRole()
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
