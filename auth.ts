/**
 * auth.ts — Auth.js (NextAuth v5) full config, node runtime only.
 *
 * Credentials provider verifies email+password against:
 *   auth.users.email  → the login identifier
 *   profiles.password_hash → argon2id hash
 * profiles.id == auth.users.id (1:1 convention from the old schema).
 *
 * Middleware imports auth.config.ts instead — never this file.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { z } from 'zod';
import authConfig from '@/auth.config';
import { db } from '@/lib/db';
import { authUsers, profiles } from '@/drizzle/schema';
import { isUserRole } from '@/lib/auth/roles';

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();

        const rows = await db
          .select({
            profileId: profiles.id,
            userId: profiles.userId,
            fullName: profiles.fullName,
            role: profiles.role,
            passwordHash: profiles.passwordHash,
            email: authUsers.email,
          })
          .from(authUsers)
          .innerJoin(profiles, eq(profiles.userId, authUsers.id))
          .where(eq(authUsers.email, email))
          .limit(1);

        const user = rows[0];
        if (!user?.passwordHash) return null;

        const valid = await argon2
          .verify(user.passwordHash, parsed.data.password)
          .catch(() => false);
        if (!valid) return null;

        if (!isUserRole(user.role)) return null;

        // Best-effort sign-in timestamp (legacy auth.users column).
        db.update(authUsers)
          .set({ lastSignInAt: new Date() })
          .where(eq(authUsers.id, user.userId))
          .then(() => undefined)
          .catch(() => undefined);

        return {
          id: user.profileId,
          email: user.email ?? email,
          name: user.fullName,
          role: user.role,
        };
      },
    }),
  ],
});
