/**
 * ResetPasswordForm Component
 * Password update form for users with reset token
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { AlertCircle, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';

export default function ResetPasswordForm() {
  const router = useRouter();
  const { updatePassword } = useAuth();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) return;

    setLoading(true);
    const result = await updatePassword(formData.password);

    if (result.success) {
      setSubmitted(true);
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } else {
      setSubmitError(result.error || 'Failed to reset password');
    }

    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Password Reset Successfully
          </h2>
          <p className="text-muted-foreground mb-6">
            Your password has been updated. Redirecting to login...
          </p>

          <Link
            href="/auth/login"
            className="inline-block w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-lg transition duration-200"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">Set New Password</h1>
        <p className="text-muted-foreground mt-2">
          Create a strong password for your account
        </p>
        <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 mt-3">
          Email reset links aren&apos;t configured on this instance — this page
          only works while you&apos;re signed in. Otherwise ask an admin to
          reset your password from Dashboard → Users.
        </p>
      </div>

      {submitError && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Reset Failed</p>
            <p className="text-sm text-destructive mt-1">{submitError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={loading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition pr-12 ${
                errors.password
                  ? 'border-destructive/40 focus:ring-destructive'
                  : 'border-input focus:ring-primary'
              } disabled:bg-muted disabled:cursor-not-allowed`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-destructive">{errors.password}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Must contain uppercase, number, 8+ characters
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              disabled={loading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition pr-12 ${
                errors.confirmPassword
                  ? 'border-destructive/40 focus:ring-destructive'
                  : 'border-input focus:ring-primary'
              } disabled:bg-muted disabled:cursor-not-allowed`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Resetting Password...
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

      <p className="text-center text-muted-foreground mt-6">
        <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium">
          Return to Sign In
        </Link>
      </p>
    </div>
  );
}
