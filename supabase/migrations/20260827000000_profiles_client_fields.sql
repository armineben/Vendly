-- =====================================================
-- PROFILS CLIENTS : coordonnées additionnelles
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' ORDER BY ordinal_position;
