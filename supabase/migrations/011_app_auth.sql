-- App-managed auth (Auth.js credentials provider, argon2id hashes)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
