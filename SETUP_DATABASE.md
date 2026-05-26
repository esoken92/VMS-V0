# Database Setup Instructions

## Step 1: Apply Migrations to Supabase

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/ilywbbeptdjhgwqrbuuf
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `supabase/migrations/001_initial_schema.sql` and paste it into the SQL editor
5. Click **Run** to execute the migration
6. Copy the contents of `supabase/migrations/002_audit_triggers.sql` and paste it into a new query
7. Click **Run** to execute the audit triggers

## Step 2: Create Test User Account

After migrations are applied, run this SQL in the SQL Editor to create a test user:

```sql
-- Create a test user (this creates the auth user)
-- You'll need to do this through the Supabase Dashboard Authentication section
-- or use the signup form in the app

-- After creating a user through the app signup form, run this to set their role:
UPDATE profiles 
SET role = 'super_admin'
WHERE user_id = 'YOUR_USER_ID_HERE';

-- To find your user_id, run:
SELECT id, email, full_name, role FROM profiles;
```

## Alternative: Quick Test User Creation

If you want to quickly create a test user with super_admin role, you can:

1. Open the app at http://localhost:3000
2. Click "Get Started" or navigate to /auth/signup
3. Sign up with a test email (e.g., admin@test.com) and password
4. After signup, go to the Supabase SQL Editor and run:

```sql
UPDATE profiles 
SET role = 'super_admin'
WHERE user_id = auth.uid();
```

This will set the currently logged-in user as a super_admin.

## Step 3: Verify Setup

Check that tables were created by running:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see these tables:
- activity_logs
- bin_locations
- products
- profiles
- receiving_documents
- receiving_items
- stock_movements
- stock_take_items
- stock_takes
- suppliers
- tool_loans
- unit_conversions

## Step 4: Test the App

1. Go to http://localhost:3000
2. Click "Get Started" to sign up
3. After signing up, update your role to super_admin using the SQL above
4. Log out and log back in
5. You should now have full access to the dashboard and all features
