/**
 * Script to update user name in Supabase Auth user_metadata
 * Run with: node scripts/update-user-name.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase configuration in .env.local file');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// User ID and name to update
const USER_ID = '6ec25daf-c53d-45a4-b322-c02707e8d861';
const USER_NAME = 'Derrick Justine Ndubussa';

async function updateUserName() {
  try {
    console.log(`Updating user name to: "${USER_NAME}"`);
    console.log(`User ID: ${USER_ID}`);
    console.log('Connecting to Supabase...\n');

    // Update user metadata
    const { data, error } = await supabase.auth.admin.updateUserById(USER_ID, {
      user_metadata: {
        name: USER_NAME,
      },
    });

    if (error) {
      console.error('❌ Error updating user name:', error);
      process.exit(1);
    }

    console.log('✅ Successfully updated user name!');
    console.log('\nUpdated user data:');
    console.log('  ID:', data.user.id);
    console.log('  Email:', data.user.email);
    console.log('  Name:', data.user.user_metadata?.name || 'Not set');
    console.log('\nThe user will see their name on the dashboard after logging in again.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
updateUserName()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
