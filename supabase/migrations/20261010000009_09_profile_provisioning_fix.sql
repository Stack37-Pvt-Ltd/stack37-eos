-- 09. Application Profile Provisioning Backfill & Trigger Idempotency
-- Narrowly scoped fix for missing application profiles:
-- 1. Idempotent, insert-only backfill of existing auth.users missing in public.profiles.
--    Does NOT overwrite any existing profile data.
-- 2. Hardens handle_new_user() trigger with ON CONFLICT (id) DO NOTHING.
-- 3. create_business() is intentionally untouched to preserve authentication lifecycle
--    separation of concerns, existing 7-day trial policy, and ownership invariants.

-- 1. Idempotently insert missing profiles for existing auth.users
INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    u.created_at
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- 2. Harden handle_new_user() with ON CONFLICT (id) DO NOTHING
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
