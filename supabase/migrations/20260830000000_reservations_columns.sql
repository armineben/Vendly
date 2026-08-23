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

-- Rendre article_id optionnel (nullable) pour ne plus bloquer les réservations à panier global (items)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'article_id'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN article_id DROP NOT NULL;
  END IF;
END $$;

-- Rendre nullable les colonnes héritées (client_name, client_phone, status, expiration_date, created_by)
-- pour ne plus violer NOT NULL lors de l'insertion depuis la caisse (panier global items)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN client_name DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'client_phone'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN client_phone DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN status DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'expiration_date'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN expiration_date DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;

-- Forcer le rechargement du schéma PostgREST (élimine l'erreur de cache)
NOTIFY pgrst, 'reload schema';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'reservations' ORDER BY ordinal_position;
