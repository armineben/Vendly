-- =============================================================
-- Fix two errors in checkout:
-- 1) Sales: drop NOT NULL on `quantite` and `prix_unitaire`
--    (the shop inserts a single row with JSON `items`; these
--     columns are meaningless for that path)
-- 2) Reservations: create the table if it doesn't exist, or
--    add the missing `date_expiration` column
-- =============================================================

-- ─────────────────────────────────────────────
-- 1) SALES – make non-essential columns nullable
-- ─────────────────────────────────────────────
ALTER TABLE public.sales ALTER COLUMN quantite      DROP NOT NULL;
ALTER TABLE public.sales ALTER COLUMN quantite      DROP DEFAULT;
ALTER TABLE public.sales ALTER COLUMN prix_unitaire DROP NOT NULL;

-- ─────────────────────────────────────────────
-- 2) RESERVATIONS – create table (idempotent)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT NOT NULL DEFAULT '',
  prenom          TEXT NOT NULL DEFAULT '',
  telephone       TEXT,
  vendeur_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_expiration TIMESTAMPTZ NOT NULL,
  statut          TEXT NOT NULL DEFAULT 'en_attente',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add any missing columns for tables that already exist
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS date_expiration TIMESTAMPTZ;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS vendeur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated read reservations" ON public.reservations
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated insert reservations" ON public.reservations
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins update reservations" ON public.reservations
    FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins delete reservations" ON public.reservations
    FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Force cache reload
NOTIFY pgrst, 'reload schema';
