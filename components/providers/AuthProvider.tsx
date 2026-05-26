/**
 * AuthProvider - Global Authentication Context
 * Manages user session, role-based state, and auth operations
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type User = any; // Supabase user type

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  impersonatedByUser: any;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  impersonateUser: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  exitImpersonation: () => { success: boolean; error?: string };
  hasRole: (requiredRoles: string | string[]) => boolean;
  setError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedByUser, setImpersonatedByUser] = useState<any>(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      if (session?.user) {
        setUser(session.user);
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setIsImpersonating(false);
        setImpersonatedByUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  // Fetch user profile with role
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message);
    }
  };

  // Login with email and password
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        await fetchUserProfile(data.user.id);

        // Redirect based on role
        if (profile?.role) {
          router.push('/dashboard');
        }
        return { success: true };
      }
      
      return { success: false, error: 'Login failed' };
    } catch (err: any) {
      const errorMessage =
        err.message === 'Invalid login credentials'
          ? 'Invalid email or password'
          : err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email and password
  const signup = async (email: string, password: string, fullName: string) => {
    try {
      setError(null);
      setLoading(true);

      // Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Create profile with 'staff' as default role
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            // @ts-ignore - Supabase types are placeholders
            id: data.user.id,
            user_id: data.user.id,
            full_name: fullName,
            role: 'staff', // Default role - admins can update
          });

        if (profileError) throw profileError;

        // Auto-login after signup (Supabase handles session)
        await fetchUserProfile(data.user.id);

        return {
          success: true,
          message:
            'Signup successful! Please check your email to confirm your account.',
        };
      }
      
      return { success: false, error: 'Signup failed' };
    } catch (err: any) {
      const errorMessage = err.message || 'Signup failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Send password reset email
  const resetPassword = async (email: string) => {
    try {
      setError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset email sent. Check your inbox.',
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Password reset failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Update password (for reset flow)
  const updatePassword = async (newPassword: string) => {
    try {
      setError(null);
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return { success: true, message: 'Password updated successfully' };
    } catch (err: any) {
      const errorMessage = err.message || 'Password update failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);
      setIsImpersonating(false);
      setImpersonatedByUser(null);
      router.push('/auth/login');
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Super admin "View As" impersonation
  const impersonateUser = async (targetUserId: string) => {
    try {
      setError(null);

      if (!profile || profile.role !== 'super_admin') {
        throw new Error('Only super admins can impersonate users');
      }

      // Fetch target user profile
      const { data: targetProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) throw error;

      // Set impersonation context
      setIsImpersonating(true);
      setImpersonatedByUser({
        originalUserId: user.id,
        originalProfile: profile,
      });

      // Store in session storage for API requests
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('impersonated_user_id', targetUserId);
        sessionStorage.setItem('impersonated_by_user_id', user.id);
      }

      router.push('/dashboard');
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Impersonation failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Exit impersonation mode
  const exitImpersonation = () => {
    try {
      setIsImpersonating(false);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('impersonated_user_id');
        sessionStorage.removeItem('impersonated_by_user_id');
      }
      router.refresh();
      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Check if user has specific role
  const hasRole = (requiredRoles: string | string[]): boolean => {
    if (!Array.isArray(requiredRoles)) {
      requiredRoles = [requiredRoles];
    }
    return !!(profile?.role && requiredRoles.includes(profile.role));
  };

  // Check if user is authenticated
  const isAuthenticated = !!user && !!profile;

  const value: AuthContextType = {
    // State
    user,
    profile,
    loading,
    error,
    isAuthenticated,
    isImpersonating,
    impersonatedByUser,

    // Methods
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    impersonateUser,
    exitImpersonation,
    hasRole,

    // Utilities
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
