/**
 * Forgot Password Page
 * Password reset request page
 */

import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata = {
  title: 'Reset Password - Warehouse IMS',
  description: 'Reset your Warehouse IMS password',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
