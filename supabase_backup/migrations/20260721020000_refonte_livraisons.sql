-- =============================================================
-- Refonte complète du module livraison
--   - Table enrichie (items JSONB, adresse complète, pipeline
--     à 5 états, timestamps par étape)
--   - Trigger de comptabilisation différée (sale créée
--     uniquement au passage en statut "paid")
--   - Trigger de réintégration stock pour les retours
-- =============================================================

-- ─── 1. MISE À JOUR TABLE COMMANDES LIVRAISON ───────────────
-- On drop et recrée pour avoir un schéma propre
DROP TABLE IF EXISTS public.commandes_livraison CASCADE;

CREATE TABLE public.commandes_livraison (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items             JSONB NOT NULL,
  total_price       NUMERIC(10,2) NOT NULL,
  shipping_fees     NUMERIC(10,2) NOT NULL DEFAULT 0,

  client_firstname  TEXT NOT NULL,
  client_lastname   TEXT NOT NULL,
  client_phone      TEXT NOT NULL,
  client_address    TEXT NOT NULL,
  client_city       TEXT NOT NULL DEFAULT '',
  client_governorate TEXT NOT NULL DEFAULT '',
  courier_notes     TEXT NOT NULL DEFAULT '',
  courier_company   TEXT NOT NULL DEFAULT '',

  delivery_status   TEXT NOT NULL DEFAULT 'prepared'
    CHECK (delivery_status IN ('prepared','shipped','in_transit','delivered','paid','cancelled')),

  prepared_at       TIMESTAMPTZ DEFAULT now(),
  shipped_at        TIMESTAMPTZ,
  in_transit_at     TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. INDEX ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commandes_status  ON public.commandes_livraison(delivery_status);
CREATE INDEX IF NOT EXISTS idx_commandes_date    ON public.commandes_livraison(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commandes_livreur ON public.commandes_livraison(courier_company);
CREATE INDEX IF NOT EXISTS idx_commandes_paid    ON public.commandes_livraison(paid_at) WHERE paid_at IS NOT NULL;

-- ─── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.commandes_livraison ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read commandes"          ON public.commandes_livraison FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert commandes"        ON public.commandes_livraison FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update commandes"               ON public.commandes_livraison FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete commandes"               ON public.commandes_livraison FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ─── 4. FONCTION DE MISE À JOUR STATUT AVEC TIMESTAMPS ───────

CREATE OR REPLACE FUNCTION public.update_delivery_status(
  p_id UUID,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.commandes_livraison
  SET
    delivery_status = p_status,
    updated_at = now(),
    shipped_at    = CASE WHEN p_status = 'shipped'    AND shipped_at    IS NULL THEN now() ELSE shipped_at END,
    in_transit_at = CASE WHEN p_status = 'in_transit' AND in_transit_at IS NULL THEN now() ELSE in_transit_at END,
    delivered_at  = CASE WHEN p_status = 'delivered'  AND delivered_at  IS NULL THEN now() ELSE delivered_at END,
    paid_at       = CASE WHEN p_status = 'paid'       AND paid_at       IS NULL THEN now() ELSE paid_at END,
    cancelled_at  = CASE WHEN p_status = 'cancelled'  AND cancelled_at  IS NULL THEN now() ELSE cancelled_at END
  WHERE id = p_id;
END;
$$;

-- ─── 5. TRIGGER : CRÉATION VENTE AU PASSAGE EN "PAID" ───────

CREATE OR REPLACE FUNCTION public.sale_on_delivery_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_id UUID;
  item JSONB;
BEGIN
  -- Ne réagir qu'au passage vers 'paid'
  IF NEW.delivery_status = 'paid' AND (OLD.delivery_status IS DISTINCT FROM 'paid') THEN
    -- Créer une vente pour chaque item (ou une vente groupée avec items JSONB)
    INSERT INTO public.sales (
      items,
      total,
      customer_name,
      customer_phone,
      payment_method,
      vendeur_id,
      statut,
      created_at
    ) VALUES (
      NEW.items,
      NEW.total_price,
      NEW.client_firstname || ' ' || NEW.client_lastname,
      NEW.client_phone,
      'livraison',
      NEW.created_by,
      'complete',
      COALESCE(NEW.paid_at, now())
    )
    RETURNING id INTO sale_id;

    -- On notifie
    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '💰 Paiement livraison encaissé : ' || NEW.client_firstname || ' ' || NEW.client_lastname || ' — ' || NEW.total_price || ' TND',
      'info',
      false,
      now()
    );
  END IF;

  -- Passage en "cancelled" : réintégrer le stock
  IF NEW.delivery_status = 'cancelled' AND (OLD.delivery_status IS DISTINCT FROM 'cancelled') THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      IF (item->>'variante_id') IS NOT NULL AND (item->>'variante_id') NOT LIKE 'virtuel-%' THEN
        UPDATE public.variantes
        SET stock = stock + (item->>'quantite')::int
        WHERE id = (item->>'variante_id')::uuid;
      END IF;
    END LOOP;

    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '🔙 Retour livraison : commande ' || NEW.client_firstname || ' ' || NEW.client_lastname || ' annulée, stock réintégré',
      'info',
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_on_delivery_paid ON public.commandes_livraison;
CREATE TRIGGER trg_sale_on_delivery_paid
  AFTER UPDATE OF delivery_status ON public.commandes_livraison
  FOR EACH ROW
  EXECUTE FUNCTION public.sale_on_delivery_paid();

-- ─── 6. RECHARGER ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
