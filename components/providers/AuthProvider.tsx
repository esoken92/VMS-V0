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
import {
  enterWorkerPreview as enterWorkerPreviewAction,
  exitWorkerPreview as exitWorkerPreviewAction,
} from '@/lib/persona-actions';
import {
  PREVIEW_COOKIE,
  PREVIEW_ROLE,
  PREVIEW_VALUE,
  canPreviewAsWorker,
  personaForRole,
  type Persona,
} from '@/lib/persona';
import type { UserRole } from '@/lib/auth/roles';
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
  /**
   * "View as worker" preview — admin/super_admin only. When true, nav +
   * route gates behave as an operator (the server-readable `vms_preview`
   * cookie is what middleware actually enforces).
   */
  previewAsOperator: boolean;
  /**
   * The role the app should behave as for UI/gating: the preview role
   * while previewing, else the (impersonation-aware) profile role.
   */
  effectiveRole: UserRole | null;
  /** 'builder' | 'operator' derived from effectiveRole (lib/persona). */
  persona: Persona | null;
  login: (email: string, password: string) => Promise<ActionResult>;
  signup: (email: string, password: string, fullName: string) => Promise<ActionResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<ActionResult>;
  updatePassword: (newPassword: string) => Promise<ActionResult>;
  impersonateUser: (targetUserId: string, reason?: string) => Promise<ActionResult>;
  exitImpersonation: () => Promise<ActionResult>;
  enterWorkerPreview: () => Promise<ActionResult>;
  exitWorkerPreview: () => Promise<ActionResult>;
  hasRole: (requiredRoles: string | string[]) => boolean;
  setError: (error: string | null) => void;
  ensureProfile: () => Promise<void>;
  /** Re-fetch the effective profile (after edits/impersonation changes). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Client-side read of the downgrade-only preview cookie (not httpOnly). */
function readPreviewCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((c) => c.trim())
    .includes(`${PREVIEW_COOKIE}=${PREVIEW_VALUE}`);
}

/** Expire the preview cookie client-side (fallback for sign-out). */
function expirePreviewCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${PREVIEW_COOKIE}=; path=/; max-age=0`;
}

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [previewAsOperator, setPreviewAsOperator] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate preview state from the cookie on mount (it survives reloads).
  useEffect(() => {
    setPreviewAsOperator(readPreviewCookie());
  }, []);

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
    setPreviewAsOperator(false);
    // Preview must not persist across sign-out: clear server-side
    // (authoritative) and expire the cookie client-side as a fallback.
    await exitWorkerPreviewAction().catch(() => undefined);
    expirePreviewCookie();
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

  const enterWorkerPreview = async (): Promise<ActionResult> => {
    const res = await enterWorkerPreviewAction();
    if (!res.success) return { success: false, error: res.error };
    setPreviewAsOperator(true);
    router.refresh();
    return { success: true };
  };

  const exitWorkerPreview = async (): Promise<ActionResult> => {
    const res = await exitWorkerPreviewAction();
    if (!res.success) return { success: false, error: res.error };
    setPreviewAsOperator(false);
    expirePreviewCookie();
    router.refresh();
    return { success: true };
  };

  const loading = status === 'loading' || (status === 'authenticated' && profileLoading && !profile);

  // The preview cookie is honoured only when the REAL session role may
  // preview (admin/super_admin) — same rule middleware applies, so a
  // forged cookie on a manager/operator session changes nothing.
  const realRole = session?.user?.role;
  const previewActive = previewAsOperator && canPreviewAsWorker(realRole);

  // Effective role = preview-as-worker role, else the impersonation-aware
  // profile role (profile is already the target's while impersonating).
  const effectiveRole: UserRole | null = previewActive
    ? PREVIEW_ROLE
    : profile?.role ?? null;
  const persona = personaForRole(effectiveRole);

  // Checks the EFFECTIVE role so preview + impersonation both apply
  // (server actions still enforce the real actor's permissions).
  const hasRole = (requiredRoles: string | string[]): boolean => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return !!effectiveRole && roles.includes(effectiveRole);
  };

  const value: AuthContextType = {
    user: sessionUser,
    profile,
    loading,
    error,
    isAuthenticated: status === 'authenticated' && !!sessionUser,
    isImpersonating: !!impersonation?.active,
    impersonatedByUser: impersonation?.impersonator ?? null,
    previewAsOperator: previewActive,
    effectiveRole,
    persona,
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    impersonateUser,
    exitImpersonation,
    enterWorkerPreview,
    exitWorkerPreview,
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
