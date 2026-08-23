-- =====================================================
-- RÉSERVATIONS : colonnes complémentaires
-- =====================================================

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS nom TEXT,
  ADD COLUMN IF NOT EXISTS prenom TEXT,
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS acompte NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items JSONB,
  ADD COLUMN IF NOT EXISTS date_expiration TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duree_heures INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS delay_type TEXT DEFAULT '24h',
  ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'en_attente';

-- Forcer le rechargement du schéma PostgREST (élimine l'erreur de cache)
NOTIFY pgrst, 'reload schema';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'reservations' ORDER BY ordinal_position;
