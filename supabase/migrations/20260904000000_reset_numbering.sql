-- =============================================================
-- REMISE À NIVEAU DE LA NUMÉROTATION (départ à 1)
-- Factures, Bons de livraison, Réservations, Commandes
-- =============================================================

-- 1. TABLE DE COMPTEURS DE DOCUMENTS
CREATE TABLE IF NOT EXISTS public.document_counters (
  prefix   TEXT PRIMARY KEY,
  counter  INT NOT NULL DEFAULT 0
);

-- 2. RPC : générer le prochain numéro (FACT-0001, DEL-0001, RES-0001...)
CREATE OR REPLACE FUNCTION public.get_next_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_counter int;
BEGIN
  INSERT INTO public.document_counters (prefix, counter)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix)
  DO UPDATE SET counter = document_counters.counter + 1
  RETURNING counter INTO v_counter;
  RETURN p_prefix || '-' || lpad(v_counter::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_number(text) TO anon;

-- 3. COLONNES NUMÉROS DE DOCUMENTS
ALTER TABLE public.commandes_livraison
  ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS document_number TEXT;

-- 4. NETTOYAGE DES DONNÉES DE TEST (opérations transactionnelles)
TRUNCATE TABLE public.returns RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.pending_carts RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.sales RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.commandes_livraison RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.reservations RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.document_counters RESTART IDENTITY CASCADE;

-- 5. RELOAD SCHÉMA
NOTIFY pgrst, 'reload schema';
