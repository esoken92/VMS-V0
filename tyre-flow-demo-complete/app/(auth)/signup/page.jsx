/**
 * Signup Page
 * User registration page
 */

import SignupForm from '@/components/auth/SignupForm';

export const metadata = {
  title: 'Create Account - Warehouse IMS',
  description: 'Create a new Warehouse Inventory Management System account',
};

export default function SignupPage() {
  return <SignupForm />;
}
