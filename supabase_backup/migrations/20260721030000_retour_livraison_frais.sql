-- =============================================================
-- Gestion des retours livraison avec frais 5 DT
--   - Ajout du statut "returned" à la table commandes_livraison
--   - Mise à jour de update_delivery_status pour le statut returned
--   - Trigger : stock réintégré + charge 5 DT dans expenses
-- =============================================================

-- ─── 1. AJOUT STATUT RETURNED ────────────────────────────────
ALTER TABLE public.commandes_livraison
  DROP CONSTRAINT IF EXISTS commandes_livraison_delivery_status_check;

ALTER TABLE public.commandes_livraison
  ADD CONSTRAINT commandes_livraison_delivery_status_check
  CHECK (delivery_status IN ('prepared','shipped','in_transit','delivered','paid','cancelled','returned'));

-- ─── 2. MISE À JOUR DE LA FONCTION DE STATUT ────────────────

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
    cancelled_at  = CASE WHEN p_status = 'cancelled'  AND cancelled_at  IS NULL THEN now() ELSE cancelled_at END,
    returned_at   = CASE WHEN p_status = 'returned'   AND returned_at   IS NULL THEN now() ELSE returned_at END
  WHERE id = p_id;
END;
$$;

-- ─── 3. AJOUT DE LA COLONNE returned_at ──────────────────────
ALTER TABLE public.commandes_livraison
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- ─── 4. MISE À JOUR DU TRIGGER GESTION STOCK + FRAIS RETOUR ──

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
  -- Passage en "paid" : créer la vente dans sales
  IF NEW.delivery_status = 'paid' AND (OLD.delivery_status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.sales (
      items, total, customer_name, customer_phone,
      payment_method, vendeur_id, statut, created_at
    ) VALUES (
      NEW.items,
      NEW.total_price,
      NEW.client_firstname || ' ' || NEW.client_lastname,
      NEW.client_phone,
      'livraison',
      NEW.created_by,
      'complete',
      COALESCE(NEW.paid_at, now())
    );

    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '💰 Paiement livraison encaissé : ' || NEW.client_firstname || ' ' || NEW.client_lastname || ' — ' || NEW.total_price || ' TND',
      'info', false, now()
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
      '🔙 Annulation livraison : commande ' || NEW.client_firstname || ' ' || NEW.client_lastname || ' annulée, stock réintégré',
      'info', false, now()
    );
  END IF;

  -- Passage en "returned" : réintégrer le stock + frais 5 DT
  IF NEW.delivery_status = 'returned' AND (OLD.delivery_status IS DISTINCT FROM 'returned') THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      IF (item->>'variante_id') IS NOT NULL AND (item->>'variante_id') NOT LIKE 'virtuel-%' THEN
        UPDATE public.variantes
        SET stock = stock + (item->>'quantite')::int
        WHERE id = (item->>'variante_id')::uuid;
      END IF;
    END LOOP;

    -- Enregistrer la charge de 5 DT pour frais de retour
    INSERT INTO public.expenses (
      motif, montant, date, created_by
    ) VALUES (
      'Frais de retour - ' || COALESCE(NULLIF(NEW.courier_company, ''), 'Transporteur inconnu') || ' - Commande #' || substring(NEW.id::text, 1, 8),
      5.00,
      CURRENT_DATE,
      NEW.created_by
    );

    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '🔙 Retour livraison : ' || NEW.client_firstname || ' ' || NEW.client_lastname || ' — Frais de retour 5 DT enregistrés (via ' || COALESCE(NULLIF(NEW.courier_company, ''), 'N/C') || ')',
      'info', false, now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 5. RECHARGER ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
