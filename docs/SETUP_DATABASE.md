# Database Setup Instructions

## Step 1: Apply Migrations to Supabase

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of each file in `supabase/migrations/` and run them
   **in numeric order** (`001_initial_schema.sql` → `009_user_alert_preferences.sql`)

Or with the CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Step 2: (Optional) Seed Data

To get four seed accounts (one per role) plus sample inventory:

```bash
# hosted project: paste the file into the SQL Editor, or
psql "$SUPABASE_DB_URL" -f supabase/seed.sql

# local supabase dev:
supabase db reset   # runs migrations + seed.sql
```

Seed logins — see the table in README.md. Only seed seed credentials into
environments you don't mind being public.

## Step 3: Create Your Own Admin Account

Sign up through the app (`/auth/signup`) — new sign-ups get the `staff`
role. Then promote yourself in the SQL Editor:

```sql
UPDATE profiles
SET role = 'super_admin'
WHERE user_id = 'YOUR_USER_ID_HERE';

-- To find your user_id:
SELECT id, email, full_name, role FROM profiles;
```

## Step 4: Verify Setup

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- activity_logs
- bin_locations
- impersonation_sessions
- products
- profiles
- receiving_documents
- receiving_items
- stock_movements
- stock_take_items
- stock_takes
- suppliers
- system_settings
- tool_loans
- unit_conversions

## Step 5: Test the App

1. Go to http://localhost:3000
2. Sign in with a seed account or your own account
3. You should now have full access matching your role
