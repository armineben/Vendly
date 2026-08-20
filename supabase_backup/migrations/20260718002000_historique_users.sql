-- =============================================================
-- Historique : suivi des utilisateurs sur toutes les opérations
-- =============================================================

-- ─── 1. AJOUT DE LA COLONNE created_by ───────────────────────

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.commandes_livraison
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 2. INDEX ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reservations_created_by
  ON public.reservations(created_by);
CREATE INDEX IF NOT EXISTS idx_commandes_created_by
  ON public.commandes_livraison(created_by);

-- ─── 3. RLS — RÉSERVATIONS ───────────────────────────────────

DROP POLICY IF EXISTS "Authenticated read reservations" ON public.reservations;
CREATE POLICY "Users read own reservations" ON public.reservations
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated insert reservations" ON public.reservations;
CREATE POLICY "Authenticated insert reservations" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 4. RLS — COMMANDES LIVRAISON ────────────────────────────

DROP POLICY IF EXISTS "Authenticated read commandes" ON public.commandes_livraison;
CREATE POLICY "Users read own commandes" ON public.commandes_livraison
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated insert commandes" ON public.commandes_livraison;
CREATE POLICY "Authenticated insert commandes" ON public.commandes_livraison
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 5. RLS — SALES (déjà vendeur_id) ────────────────────────

DROP POLICY IF EXISTS "Authenticated read sales" ON public.sales;
CREATE POLICY "Users read own sales" ON public.sales
  FOR SELECT TO authenticated
  USING (vendeur_id = auth.uid() OR public.is_admin(auth.uid()));

-- ─── 6. RECHARGER LE CACHE ──────────────────────────────────

NOTIFY pgrst, 'reload schema';
