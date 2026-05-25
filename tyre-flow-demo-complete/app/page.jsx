/**
 * Home Page
 * Landing page that redirects authenticated users to dashboard
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-blue-600">Warehouse IMS</h1>
          </div>
          <div className="flex gap-4">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Enterprise Inventory Management
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Streamline your warehouse operations with real-time inventory tracking,
            barcode scanning, and offline-first technology designed for
            heavy-duty truck parts distribution.
          </p>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 my-16">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl mb-4">📦</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Real-Time Inventory
              </h3>
              <p className="text-gray-600">
                Track stock levels with decimal precision for fluids and bulk items
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl mb-4">📱</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Mobile First
              </h3>
              <p className="text-gray-600">
                Native barcode scanning and offline-first PWA for warehouse floor access
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Enterprise Security
              </h3>
              <p className="text-gray-600">
                Immutable audit logs, role-based access, and user impersonation tracking
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-lg"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-3 bg-white hover:bg-gray-50 text-blue-600 border-2 border-blue-600 rounded-lg font-medium text-lg"
            >
              Sign In
            </Link>
          </div>

          {/* Demo Credentials */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-16 p-6 bg-blue-50 border border-blue-200 rounded-lg inline-block">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Demo Credentials (Development):
              </p>
              <p className="text-sm text-blue-800 font-mono">
                Email: demo@warehouse.local
              </p>
              <p className="text-sm text-blue-800 font-mono">
                Password: Demo@123
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p>
            © 2024 Warehouse Inventory Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
