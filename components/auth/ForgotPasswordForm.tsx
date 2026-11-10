/**
 * ForgotPasswordForm Component
 * Password reset request form
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { AlertCircle, Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordForm() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail()) return;

    setLoading(true);
    const result = await resetPassword(email);

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error || 'Failed to send reset email');
    }

    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Contact Your Administrator
          </h2>
          <p className="text-gray-600 mb-6">
            Password reset emails aren&apos;t enabled on this self-hosted
            instance — no mail provider is configured yet.
          </p>

          <div className="p-4 bg-secondary border border-border rounded-lg mb-6">
            <p className="text-sm text-foreground">
              Ask an admin to reset the password for:
            </p>
            <p className="text-sm text-foreground font-mono mt-2">{email}</p>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Admins can set a new password from{' '}
            <strong>Dashboard → Users</strong>. If you signed up on this
            instance, your account is active and you can sign in directly.
          </p>

          <Link
            href="/auth/login"
            className="inline-block w-full bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-lg transition duration-200 mb-4"
          >
            Return to Sign In
          </Link>

          <button
            onClick={() => {
              setSubmitted(false);
              setEmail('');
            }}
            className="text-primary hover:text-primary/80 text-sm underline"
          >
            Try another email address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
        <p className="text-gray-600 mt-2">
          Enter your email — your administrator can reset it for you
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            disabled={loading}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary'
            } disabled:bg-gray-100 disabled:cursor-not-allowed`}
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Request Password Reset'
          )}
        </button>
      </form>

      <p className="text-center text-gray-600 mt-6">
        Remember your password?{' '}
        <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
