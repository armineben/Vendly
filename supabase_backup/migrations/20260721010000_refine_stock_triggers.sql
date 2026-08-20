-- ============================================================
-- MISE À JOUR : notifications de stock affinées
--   - Seuil abaissé 3 → 2
--   - Rupture (0) séparée du stock faible (1-2)
--   - Pas de notification pour les nouveaux articles créés avec
--     un stock initial faible (OLD.quantite IS NULL → skip)
--   - Ajout d'un trigger similaire sur la table variantes
-- ============================================================

-- ── 1. Trigger sur articles ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ignorer les nouvelles créations (pas de quantité précédente)
  IF OLD.quantite IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rupture de stock : passage à 0
  IF NEW.quantite <= 0 AND OLD.quantite > 0 THEN
    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '🔴 Rupture de stock : ' || COALESCE(NEW.designation, 'Article inconnu') || ' est en rupture (0 unité)',
      'low_stock',
      false,
      now()
    );
    RETURN NEW;
  END IF;

  -- Stock faible : passage de > 2 à <= 2
  IF NEW.quantite <= 2 AND OLD.quantite > 2 THEN
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

-- ── 2. Nouveau trigger sur variantes ────────────────────────

CREATE OR REPLACE FUNCTION public.notify_variante_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  article_designation TEXT;
BEGIN
  -- Ignorer les nouvelles créations
  IF OLD.stock IS NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer le nom de l'article parent
  SELECT designation INTO article_designation
  FROM public.articles
  WHERE id = NEW.article_id;

  -- Rupture de stock
  IF NEW.stock <= 0 AND OLD.stock > 0 THEN
    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '🔴 Rupture de stock : ' || COALESCE(article_designation, 'Article inconnu') || ' (' || COALESCE(NEW.couleur, '?') || ' / ' || COALESCE(NEW.taille, 'TU') || ') est en rupture (0 unité)',
      'low_stock',
      false,
      now()
    );
    RETURN NEW;
  END IF;

  -- Stock faible : passage de > 2 à <= 2
  IF NEW.stock <= 2 AND OLD.stock > 2 THEN
    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (
      NULL,
      '⚠️ Alerte Stock Bas : ' || COALESCE(article_designation, 'Article inconnu') || ' (' || COALESCE(NEW.couleur, '?') || ' / ' || COALESCE(NEW.taille, 'TU') || ') n''a plus que ' || NEW.stock || ' unités en stock',
      'low_stock',
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_variante_stock ON public.variantes;
CREATE TRIGGER trg_notify_variante_stock
  AFTER UPDATE OF stock ON public.variantes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_variante_stock();

NOTIFY pgrst, 'reload schema';
