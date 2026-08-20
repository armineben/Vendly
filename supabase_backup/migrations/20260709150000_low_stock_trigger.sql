-- ============================================================
-- TRIGGER : notification automatique quand articles.quantite ≤ 3
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantite <= 3 AND (OLD.quantite IS NULL OR OLD.quantite > 3) THEN
    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '⚠️ Alerte Stock Bas : ' || COALESCE(NEW.designation, 'Article inconnu') || ' n''a plus que ' || NEW.quantite || ' unités en stock',
      'low_stock',
      false,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Déclencheur AFTER UPDATE sur articles (après vente ou modification manuelle)
DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.articles;
CREATE TRIGGER trg_notify_low_stock
  AFTER UPDATE OF quantite ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();

-- ============================================================
-- INSERT initial : notifier TOUS les articles déjà ≤ 3
-- ============================================================
INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
SELECT
  NULL,
  '⚠️ Alerte Stock Bas : ' || COALESCE(a.designation, 'Article inconnu') || ' n''a plus que ' || a.quantite || ' unités en stock',
  'low_stock',
  false,
  now()
FROM public.articles a
WHERE a.quantite <= 3
  AND a.status = 'actif'
  -- Évite les doublons si la notif existe déjà aujourd'hui pour le même article
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.message LIKE '%' || a.designation || '%'
      AND n.type = 'low_stock'
      AND n.created_at::date = CURRENT_DATE
  );

NOTIFY pgrst, 'reload schema';
