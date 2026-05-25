/**
 * Reset Password Page
 * Password update page after user clicks reset link
 */

import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata = {
  title: 'Set New Password - Warehouse IMS',
  description: 'Create a new password for your Warehouse IMS account',
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
