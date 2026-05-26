'use client';

import { AuthProvider } from '@/components/providers/AuthProvider';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
