/**
 * AuthProvider - Global Authentication Context
 * Auth.js (NextAuth v5) credentials session + server actions.
 *
 * `profile` is the EFFECTIVE profile — when a super_admin impersonates
 * someone, it's the target's profile (matching the old sessionStorage UX,
 * now enforced server-side via the impersonation cookie + DB session row).
 */

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SessionProvider, signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getSessionProfile } from '@/lib/actions/session-profile';
import { signupUser, requestPasswordReset, changeMyPassword } from '@/lib/actions/auth';
import { startImpersonation, endImpersonation } from '@/lib/actions/impersonation';
import type { ImpersonationState, ProfileDTO } from '@/lib/types';

export interface SessionUser {
  id: string;
  email: string | null;
  name?: string | null;
}

interface ActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

interface AuthContextType {
  user: SessionUser | null;
  profile: ProfileDTO | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  /** The real signed-in admin while impersonating (null otherwise). */
  impersonatedByUser: { id: string; full_name: string } | null;
  login: (email: string, password: string) => Promise<ActionResult>;
  signup: (email: string, password: string, fullName: string) => Promise<ActionResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<ActionResult>;
  updatePassword: (newPassword: string) => Promise<ActionResult>;
  impersonateUser: (targetUserId: string, reason?: string) => Promise<ActionResult>;
  exitImpersonation: () => Promise<ActionResult>;
  hasRole: (requiredRoles: string | string[]) => boolean;
  setError: (error: string | null) => void;
  ensureProfile: () => Promise<void>;
  /** Re-fetch the effective profile (after edits/impersonation changes). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionUser: SessionUser | null = useMemo(
    () =>
      session?.user
        ? {
            id: session.user.id,
            email: session.user.email ?? null,
            name: session.user.name ?? null,
          }
        : null,
    [session?.user],
  );

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setImpersonation(null);
      return;
    }
    setProfileLoading(true);
    try {
      const result = await getSessionProfile();
      if (result.success && result.data) {
        setProfile(result.data.profile);
        setImpersonation(result.data.impersonation);
      } else if (result.success) {
        setProfile(null);
        setImpersonation(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user]);

  // Fetch the effective profile whenever the session user changes.
  useEffect(() => {
    if (status === 'authenticated') {
      void refreshProfile();
    } else if (status === 'unauthenticated') {
      setProfile(null);
      setImpersonation(null);
    }
  }, [status, refreshProfile]);

  const ensureProfile = useCallback(async () => {
    if (sessionUser && !profile && !profileLoading) {
      await refreshProfile();
    }
  }, [sessionUser, profile, profileLoading, refreshProfile]);

  const login = async (email: string, password: string): Promise<ActionResult> => {
    setError(null);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      const msg = 'Invalid email or password';
      setError(msg);
      return { success: false, error: msg };
    }
    return { success: true };
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string,
  ): Promise<ActionResult> => {
    setError(null);
    const res = await signupUser({ email, password, full_name: fullName });
    if (!res.success) {
      setError(res.error);
      return { success: false, error: res.error };
    }
    // Auto sign-in after signup
    const signInRes = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (signInRes?.error) {
      return {
        success: true,
        message: 'Account created. Please sign in.',
      };
    }
    router.push('/dashboard');
    return { success: true, message: 'Account created.' };
  };

  const logout = async () => {
    setProfile(null);
    setImpersonation(null);
    await signOut({ redirect: false });
    router.push('/auth/login');
  };

  const resetPassword = async (email: string): Promise<ActionResult> => {
    setError(null);
    const res = await requestPasswordReset({ email });
    if (!res.success) return { success: false, error: res.error };
    return { success: true, message: res.data.message };
  };

  const updatePassword = async (newPassword: string): Promise<ActionResult> => {
    setError(null);
    const res = await changeMyPassword({ new_password: newPassword });
    if (!res.success) {
      setError(res.error);
      return { success: false, error: res.error };
    }
    return { success: true, message: 'Password updated successfully' };
  };

  const impersonateUser = async (
    targetUserId: string,
    reason?: string,
  ): Promise<ActionResult> => {
    setError(null);
    const res = await startImpersonation({
      target_user_id: targetUserId,
      reason: reason || null,
    });
    if (!res.success) {
      setError(res.error);
      return { success: false, error: res.error };
    }
    await refreshProfile();
    router.push('/dashboard');
    router.refresh();
    return { success: true };
  };

  const exitImpersonation = async (): Promise<ActionResult> => {
    const res = await endImpersonation();
    if (!res.success) return { success: false, error: res.error };
    setImpersonation(null);
    await refreshProfile();
    router.refresh();
    return { success: true };
  };

  const hasRole = (requiredRoles: string | string[]): boolean => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return !!profile?.role && roles.includes(profile.role);
  };

  const loading = status === 'loading' || (status === 'authenticated' && profileLoading && !profile);

  const value: AuthContextType = {
    user: sessionUser,
    profile,
    loading,
    error,
    isAuthenticated: status === 'authenticated' && !!sessionUser,
    isImpersonating: !!impersonation?.active,
    impersonatedByUser: impersonation?.impersonator ?? null,
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    impersonateUser,
    exitImpersonation,
    hasRole,
    setError,
    ensureProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProviderInner>{children}</AuthProviderInner>
    </SessionProvider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
