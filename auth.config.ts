/**
 * auth.config.ts — edge-safe Auth.js configuration shared by the middleware
 * bundle and the full auth.ts. MUST NOT import the DB, argon2, or any
 * node-only module (it is bundled into edge middleware).
 */

import type { NextAuthConfig } from 'next-auth';

export default {
  providers: [], // providers are added in auth.ts (node runtime only)
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8h workday session
  },
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as typeof session.user.role;
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
