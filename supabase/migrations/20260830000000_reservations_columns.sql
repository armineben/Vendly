-- =====================================================
-- RÉSERVATIONS : colonnes complémentaires
-- =====================================================

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS prenom TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS acompte NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_expiration TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duree_heures INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS delay_type TEXT DEFAULT '24h';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'reservations' ORDER BY ordinal_position;
