/**
 * Login Page
 * User authentication entry point
 */

import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign In - Warehouse IMS',
  description: 'Sign in to your Warehouse Inventory Management System account',
};

export default function LoginPage() {
  return <LoginForm />;
}
