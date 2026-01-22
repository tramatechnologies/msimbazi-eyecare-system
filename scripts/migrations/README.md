# Database migrations

Run these in **Supabase SQL Editor** (Dashboard → SQL Editor), via **npm run db:migrate**, or with **psql** against your Supabase Postgres instance.

## Order

1. **001_emr_tables_and_patients_extensions.sql** – EMR support  
   - New columns on `patients`: `status`, `checked_in_at`, `assigned_provider_id`, `chief_complaint`, `clinical_notes`, `consultation_notes`, `diagnosis`, `appointment` (JSONB), `nhif_auth_number`, `deleted_at`  
   - New tables: `prescriptions`, `bill_items`, `appointments`  
   - Indexes for queue, lookups, and soft delete  

## Applying

### Option 1: npm script (recommended)

1. Add your Postgres connection string to `.env.local`:
   ```bash
   DATABASE_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   Get it from **Supabase → Project Settings → Database → Connection string** (URI).

2. Install deps and run:
   ```bash
   npm install
   npm run db:migrate
   ```

### Option 2: Supabase SQL Editor

Paste the contents of `001_emr_tables_and_patients_extensions.sql` into **Supabase Dashboard → SQL Editor** and run.

### Option 3: Supabase CLI

```bash
supabase db execute -f scripts/migrations/001_emr_tables_and_patients_extensions.sql
```

Ensure the `patients` table already exists (from your initial Supabase setup). This migration only adds columns and new tables.
