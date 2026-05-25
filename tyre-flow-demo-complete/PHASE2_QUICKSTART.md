# Phase 2: Quick Start Guide - Running the Authentication System

## Prerequisites

- Node.js 18+ and npm 9+
- Supabase account with project created
- Git (optional)

## Step 1: Set Up Environment Variables

```bash
cd tyre-flow-demo-complete

# Create local env file
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Get these values from your Supabase project:
1. Go to [supabase.com](https://supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the URL and Anon Key

## Step 2: Create Demo User (Optional)

In Supabase, go to **Auth** → **Users** and manually create a test user:
- Email: `demo@warehouse.local`
- Password: `Demo@123`
- Confirm email (click the confirm button)

Then create a profile in the `profiles` table:
```sql
INSERT INTO profiles (id, user_id, email, full_name, role, is_active)
VALUES (
  'user-uuid-here',
  'user-uuid-here',
  'demo@warehouse.local',
  'Demo User',
  'picker',
  true
);
```

Get the user UUID from the **Users** tab in Supabase Auth.

## Step 3: Install Dependencies

```bash
npm install
```

This installs:
- `next` 14.0.0
- `react` 18.2.0
- `@supabase/supabase-js` for database/auth
- `tailwindcss` for styling
- `lucide-react` for icons
- And all other dependencies from `package.json`

## Step 4: Run Development Server

```bash
npm run dev
```

Output:
```
> Next.js app is running on http://localhost:3000
```

## Step 5: Test Authentication

### Test Sign Up
1. Open http://localhost:3000
2. Click "Sign Up"
3. Fill in form:
   - Full Name: `John Doe`
   - Email: `john@example.com`
   - Password: `SecurePass123`
   - Confirm Password: `SecurePass123`
4. Accept terms
5. Click "Create Account"
6. You should see success screen with email verification message

### Test Login
1. Go to http://localhost:3000/auth/login
2. Enter demo credentials:
   - Email: `demo@warehouse.local`
   - Password: `Demo@123`
3. Click "Sign In"
4. Should redirect to `/dashboard`
5. See dashboard with user info and logout button

### Test Password Reset
1. Go to http://localhost:3000/auth/login
2. Click "Forgot password?"
3. Enter email (any email works)
4. In Supabase **Auth** → **Email Templates**, you'll see the reset link
5. Copy the reset link from the email template
6. Manually navigate to reset page with token:
   - Go to: `/auth/reset-password?type=recovery&code=YOUR_CODE_HERE`
7. Enter new password and confirm
8. Should redirect to login

## Step 6: Access Protected Routes

### As Authenticated User
- ✅ Can access: `/dashboard`
- ❌ Redirected from: `/auth/login`, `/auth/signup`

### As Unauthenticated User
- ✅ Can access: `/auth/login`, `/auth/signup`, `/auth/forgot-password`
- ❌ Redirected from: `/dashboard` → `/auth/login`

## Understanding the Code Flow

### Sign Up Flow
```
SignupForm 
  → useAuth().signup()
    → Supabase Auth.signUp()
    → Create profiles table entry
    → Show success screen
```

### Login Flow
```
LoginForm
  → useAuth().login()
    → Supabase Auth.signInWithPassword()
    → Fetch user profile with role
    → AuthProvider updates state
    → Middleware redirects to /dashboard
```

### Protected Routes
```
User visits /dashboard
  → Middleware checks token
  → If no token → redirect to /auth/login
  → If token exists → Load dashboard
  → AuthProvider checks profile role
  → Display dashboard content
```

## Debugging

### Issue: "Invalid login credentials"
**Solution**: Check that:
- Email exists in Supabase Auth
- Email is confirmed (check in Auth → Users)
- Password is correct
- Profile exists in `profiles` table with matching user UUID

### Issue: "Service Worker registration failed"
**Solution**: This is normal in development. Service Worker requires HTTPS in production.

### Issue: Form validation errors on signup
**Solution**: Password must have:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one number (0-9)

### Issue: "Cannot find useAuth"
**Solution**: Make sure to:
1. Use `import { useAuth } from '@/hooks/useAuth'`
2. Only call `useAuth()` inside components marked with `'use client'`
3. Components must be inside AuthProvider (they are in layout.jsx)

## Development Tips

### Hot Reload
- Changes to components reload automatically
- Changes to `.env.local` require manual reload

### Browser DevTools
- Check **Application** tab for Service Worker
- Check **Network** tab for Supabase requests
- Check **Console** for error messages

### Tailwind Classes
- All styling uses Tailwind utility classes
- See `tailwind.config.js` for customization
- Use `@apply` to create custom components

### Testing in Mobile
```bash
# Get your local IP
ipconfig getifaddr en0   # macOS
hostname -I              # Linux
ipconfig                 # Windows

# Access from mobile: http://YOUR_IP:3000
```

## Next Steps

After authentication is working:

1. **Add Dashboard Navigation**
   - Create Sidebar component
   - Add menu items for inventory, reports, etc.

2. **Build Inventory Module**
   - Product CRUD
   - Barcode scanning
   - Stock search

3. **Stock Movements**
   - Inbound receiving
   - Outbound shipments
   - Scrap tracking

4. **Reports & Dashboards**
   - Executive KPI dashboard
   - Variance reports
   - Tool custody board

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Run production build

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run type-check       # TypeScript checking
npm run test             # Run tests (if configured)

# Database
npm run db:migrate       # List migrations
npm run db:push          # Push schema changes
```

## Getting Help

### Documentation
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)

### Common Issues
- Check Supabase project is running
- Verify SUPABASE_URL and SUPABASE_ANON_KEY
- Check browser console for errors
- Clear browser cache if styles look wrong

### Need to Reset Everything?
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install

# Clear next cache
rm -rf .next

# Restart dev server
npm run dev
```

---

## Architecture Quick Reference

```
┌─ Home Page (/)
├─ Auth Routes (/auth/*)
│  ├─ Login (/auth/login)
│  ├─ Signup (/auth/signup)
│  ├─ Forgot Password (/auth/forgot-password)
│  └─ Reset Password (/auth/reset-password)
└─ Dashboard Routes (/dashboard/*)
   ├─ Dashboard Home (/dashboard) [Protected]
   ├─ Inventory (/dashboard/inventory) [Protected]
   ├─ Stock Movements (/dashboard/stock-movements) [Protected]
   └─ Reports (/dashboard/reports) [Admin Only]

Providers (Global State):
├─ AuthProvider (User auth state)
├─ PWAProvider (Offline detection)
└─ SyncProvider (Background sync)

Middleware:
└─ Route Protection (Auth checks)
```

---

**Status**: ✅ Ready to Test | Full Auth System Deployed Locally

Good luck! 🚀
