-- ============================================================
-- Unification des réservations
--   - Ajoute les colonnes manquantes (duree_heures, created_by,
--     delay_type) à la table existante
--   - RPC pour la détection de conflit de stock
--   - Maintient la compatibilité avec les schémas old et new
-- ============================================================

-- ─── 1. AJOUT DES COLONNES MANQUANTES ──────────────────────
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS duree_heures INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delay_type TEXT DEFAULT '24h'
    CHECK (delay_type IN ('le_jour_meme', '24h', '48h', '72h')),
  ADD COLUMN IF NOT EXISTS vendeur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── 2. INDEX POUR LES RECHERCHES DE CONFLIT ───────────────
CREATE INDEX IF NOT EXISTS idx_reservations_items_variante
  ON public.reservations USING GIN (items jsonb_path_ops);

-- ─── 3. RPC : RÉSERVATIONS ACTIVES POUR UNE VARIANTE ──────

CREATE OR REPLACE FUNCTION public.get_active_reservations_for_variante(
  p_variante_id UUID
)
RETURNS TABLE (
  id UUID,
  nom TEXT,
  prenom TEXT,
  telephone TEXT,
  quantite_reservee INT,
  expires_at TIMESTAMPTZ,
  statut TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.nom,
    r.prenom,
    r.telephone,
    (elem->>'quantite')::int AS quantite_reservee,
    r.date_expiration AS expires_at,
    r.statut
  FROM public.reservations r,
       jsonb_array_elements(r.items) AS elem
  WHERE (elem->>'variante_id')::uuid = p_variante_id
    AND r.date_expiration > now()
    AND r.statut = 'en_attente'
  ORDER BY r.date_expiration ASC;
$$;

-- ─── 4. RPC : STOCK RÉSERVÉ TOTAL POUR UNE VARIANTE ───────

CREATE OR REPLACE FUNCTION public.get_reserved_stock_for_variante(
  p_variante_id UUID
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM((elem->>'quantite')::int), 0)
  FROM public.reservations r,
       jsonb_array_elements(r.items) AS elem
  WHERE (elem->>'variante_id')::uuid = p_variante_id
    AND r.date_expiration > now()
    AND r.statut = 'en_attente';
$$;

-- ─── 5. MISE À JOUR DE LA FONCTION D'EXPIRATION ───────────

CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  item JSONB;
BEGIN
  FOR r IN
    SELECT id, items
    FROM public.reservations
    WHERE statut = 'en_attente' AND date_expiration <= now()
    FOR UPDATE
  LOOP
    UPDATE public.reservations
      SET statut = 'expiré'
      WHERE id = r.id;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
