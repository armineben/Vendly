-- =============================================================
-- Réservations & Commandes Livraison
-- =============================================================

-- ─── Suppression de l'ancienne table réservations ────────────
DROP TABLE IF EXISTS public.reservations CASCADE;

-- ─── 1. TABLE RÉSERVATIONS ───────────────────────────────────
CREATE TABLE public.reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  client_name     TEXT NOT NULL,
  client_phone    TEXT NOT NULL,
  type_reservation TEXT NOT NULL DEFAULT '24h' CHECK (type_reservation IN ('24h', 'custom_date')),
  expiration_date TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'acheté', 'expiré')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. TABLE COMMANDES LIVRAISON ────────────────────────────
CREATE TABLE public.commandes_livraison (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  client_firstname  TEXT NOT NULL,
  client_lastname   TEXT NOT NULL,
  client_address    TEXT NOT NULL,
  client_phone      TEXT NOT NULL,
  total_price       NUMERIC(10,2) NOT NULL,
  delivery_status   TEXT NOT NULL DEFAULT 'en_attente' CHECK (delivery_status IN ('en_attente', 'chez_le_livreur', 'livre_attente_paiement', 'valide_et_encaisse')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. INDEX ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reservations_article     ON public.reservations(article_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status      ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_expiration  ON public.reservations(expiration_date);
CREATE INDEX IF NOT EXISTS idx_commandes_article        ON public.commandes_livraison(article_id);
CREATE INDEX IF NOT EXISTS idx_commandes_status         ON public.commandes_livraison(delivery_status);

-- ─── 4. RLS ──────────────────────────────────────────────────

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read reservations"       ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert reservations"     ON public.reservations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update reservations"            ON public.reservations FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete reservations"            ON public.reservations FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.commandes_livraison ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read commandes"          ON public.commandes_livraison FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert commandes"        ON public.commandes_livraison FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update commandes"               ON public.commandes_livraison FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete commandes"               ON public.commandes_livraison FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ─── 5. FONCTION D'EXPIRATION AUTO ───────────────────────────
CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, article_id
    FROM public.reservations
    WHERE status = 'actif' AND expiration_date <= now()
    FOR UPDATE
  LOOP
    UPDATE public.reservations
      SET status = 'expiré'
      WHERE id = r.id;

    UPDATE public.articles
      SET quantite = quantite + 1
      WHERE id = r.article_id;
  END LOOP;
END;
$$;

-- ─── 6. TÂCHE PLANIFIÉE (toutes les heures) ──────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

SELECT cron.schedule(
  'expire-reservations-hourly',
  '0 * * * *',
  $$SELECT public.expire_reservations();$$
);

-- ─── 7. RECHARGER LE CACHE ──────────────────────────────────
NOTIFY pgrst, 'reload schema';
