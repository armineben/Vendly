-- ============================================================
-- Ajout des colonnes manquantes à commandes_livraison
-- (sans DROP, ALTER TABLE ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE public.commandes_livraison
  ADD COLUMN IF NOT EXISTS items              JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shipping_fees      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_city        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_governorate TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS courier_notes      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS courier_company    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prepared_at        TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS shipped_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_transit_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT now();

-- Mise à jour de la CHECK constraint pour inclure returned
ALTER TABLE public.commandes_livraison
  DROP CONSTRAINT IF EXISTS commandes_livraison_delivery_status_check;

ALTER TABLE public.commandes_livraison
  ADD CONSTRAINT commandes_livraison_delivery_status_check
  CHECK (delivery_status IN ('prepared','shipped','in_transit','delivered','paid','cancelled','returned'));

NOTIFY pgrst, 'reload schema';
