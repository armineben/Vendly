-- =====================================================
-- SAV : Retours, Remboursements & Échanges
-- =====================================================

CREATE TABLE IF NOT EXISTS public.returns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id          UUID REFERENCES public.commandes_livraison(id) ON DELETE SET NULL,
  client_name          TEXT,
  client_phone         TEXT,
  email                TEXT,
  items                JSONB DEFAULT '[]'::jsonb,
  reason               TEXT,
  type                 TEXT NOT NULL DEFAULT 'retour' CHECK (type IN ('retour','echange','remboursement')),
  status               TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente','valide','refuse','rembourse','echange')),
  amount               NUMERIC DEFAULT 0,
  stock_reintegrated   BOOLEAN NOT NULL DEFAULT false,
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returns_status  ON public.returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_created ON public.returns(created_at DESC);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated all returns" ON public.returns;
CREATE POLICY "Authenticated all returns" ON public.returns FOR ALL USING (auth.role() = 'authenticated');

-- RPC : valider un retour (réinjecte le stock)
CREATE OR REPLACE FUNCTION public.valider_retour(p_return_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_returns record;
  v_item jsonb;
BEGIN
  SELECT * INTO v_returns FROM public.returns WHERE id = p_return_id;
  IF v_returns.id IS NULL THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_returns.stock_reintegrated THEN RETURN; END IF;

  -- Réinjecter le stock des variantes
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_returns.items, '[]'::jsonb)) LOOP
    IF (v_item->>'variante_id') IS NOT NULL AND (v_item->>'variante_id') <> '' THEN
      UPDATE public.variantes
        SET stock = stock + COALESCE((v_item->>'quantite')::int, 1)
        WHERE id = (v_item->>'variante_id')::uuid;
    ELSIF (v_item->>'article_id') IS NOT NULL AND (v_item->>'article_id') <> '' THEN
      UPDATE public.articles
        SET quantite = quantite + COALESCE((v_item->>'quantite')::int, 1)
        WHERE id = (v_item->>'article_id')::uuid;
    END IF;
  END LOOP;

  UPDATE public.returns
    SET status = 'valide', stock_reintegrated = true, updated_at = now()
    WHERE id = p_return_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.valider_retour(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
