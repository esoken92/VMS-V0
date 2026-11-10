/**
 * LoginForm Component
 * Email/password login with error handling and loading state
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, error: authError, loading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    station: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Station is optional for now
    // if (!formData.station) {
    //   newErrors.station = 'Station selection is required';
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return formData.email && 
           formData.password && 
           formData.password.length >= 6 &&
           /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
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

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      // Honor middleware's ?next= redirect target (dashboard default).
      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') ? next : '/dashboard');
      router.refresh();
    } else {
      setSubmitError(result.error || 'Login failed');
    }

    setIsSubmitting(false);
  };

  const displayError = submitError || authError;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">VMS V0</h1>
        <p className="text-muted-foreground mt-2">Inventory Management System</p>
      </div>

      {/* Error Alert */}
      {displayError && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Login Failed</p>
            <p className="text-sm text-destructive mt-1">{displayError}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={isSubmitting || loading}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${
              errors.email
                ? 'border-destructive/40 focus:ring-destructive'
                : 'border-input focus:ring-primary'
            } disabled:bg-muted disabled:cursor-not-allowed`}
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={isSubmitting || loading}
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
              disabled={isSubmitting || loading}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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
        </div>

        {/* Station Selection */}
        <div>
          <label htmlFor="station" className="block text-sm font-medium text-foreground mb-2">
            Work Station
          </label>
          <select
            id="station"
            name="station"
            value={formData.station}
            onChange={handleInputChange}
            disabled={isSubmitting || loading}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${
              errors.station
                ? 'border-destructive/40 focus:ring-destructive'
                : 'border-input focus:ring-primary'
            } disabled:bg-muted disabled:cursor-not-allowed`}
          >
            <option value="">Select your station</option>
            <option value="receiving">Receiving / Goods In</option>
            <option value="warehouse">Warehouse / Storage</option>
            <option value="dispatch">Dispatch / Shipping</option>
            <option value="maintenance">Maintenance Shop</option>
            <option value="office">Office / Admin</option>
          </select>
          {errors.station && (
            <p className="mt-1 text-sm text-destructive">{errors.station}</p>
          )}
        </div>

        {/* Forgot Password Link */}
        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-primary hover:text-primary/80 font-medium"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || loading || !isFormValid()}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          {isSubmitting || loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {/* Sign Up Link */}
      <p className="text-center text-muted-foreground mt-6">
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/signup"
          className="text-primary hover:text-primary/80 font-medium"
        >
          Sign up
        </Link>
      </p>

      {/* Seed accounts (created by `npm run db:seed` — local development only) */}
      <div className="mt-8 p-4 bg-info/10 border border-info/30 rounded-lg">
        <p className="text-sm font-medium text-info mb-3">Seed accounts</p>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-info font-medium">Admin:</span>
            <span className="text-info">admin@vms-v0.local / VmsAdmin123!</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-info font-medium">Manager:</span>
            <span className="text-info">manager@vms-v0.local / VmsManager123!</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-info font-medium">Staff:</span>
            <span className="text-info">worker@vms-v0.local / VmsWorker123!</span>
          </div>
        </div>
        <p className="text-xs text-info mt-3 italic">
          Seed accounts for local development — change or remove before any real deployment
        </p>
      </div>
    </div>
  );
}
