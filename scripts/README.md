# Assign Super Admin Role

This directory contains scripts to assign the `super_admin` role to a user in Supabase.

## User ID
- **UID**: `6ec25daf-c53d-45a4-b322-c02707e8d861`

## Method 1: Using SQL (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `assign-super-admin.sql`
4. Click **Run** to execute the SQL

This is the fastest and most reliable method.

## Method 2: Using Node.js Script

1. Make sure your `.env` file has:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Run the script:
   ```bash
   npm run assign-super-admin
   ```

## Verification

After running either method, verify the role was assigned:

```sql
SELECT user_id, role, created_at, updated_at
FROM user_roles
WHERE user_id = '6ec25daf-c53d-45a4-b322-c02707e8d861';
```

The result should show `role = 'super_admin'`.
