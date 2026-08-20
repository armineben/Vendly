-- ============================================================
-- 1. COLONNE created_by SUR articles
-- ============================================================
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 2. TRIGGER : remplir created_by automatiquement à l'insertion
-- ============================================================
CREATE OR REPLACE FUNCTION public.fill_article_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_article_created_by ON public.articles;
CREATE TRIGGER trg_fill_article_created_by
  BEFORE INSERT ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_article_created_by();

-- ============================================================
-- 3. TRIGGER : notification quand un article est ajouté
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_new_article()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  SELECT COALESCE(p.display_name, 'Quelqu''un') INTO v_display_name
  FROM public.profiles p
  WHERE p.id = COALESCE(NEW.created_by, auth.uid());

  INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
  VALUES (
    NULL,
    '📦 ' || v_display_name || ' a ajouté l''article "' || COALESCE(NEW.designation, 'Sans nom') || '" (Réf: ' || COALESCE(NEW.reference, 'N/A') || ')',
    'new_article',
    false,
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_article ON public.articles;
CREATE TRIGGER trg_notify_new_article
  AFTER INSERT ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_article();

-- ============================================================
-- 4. TÂCHES PLANIFIÉES (pg_cron)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

-- Rappel quotidien du rapport journalier à 22:00
SELECT cron.schedule(
  'daily-report-notification',
  '0 22 * * *',
  $$INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (NULL, '📋 Rapport journalier disponible — Téléchargez votre fichier Excel depuis l''onglet Rapports.', 'report', false, now());$$
);

-- Rappel de fin de mois (le 28 à 23:30, avec vérification du dernier jour)
SELECT cron.schedule(
  'monthly-report-notification',
  '30 23 28-31 * *',
  $$INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    SELECT NULL, '📆 Rapport mensuel disponible — Téléchargez votre fichier Excel depuis l''onglet Rapports.', 'report', false, now()
    WHERE EXTRACT(DAY FROM (CURRENT_DATE + interval '1 day')) = 1;$$
);

-- Rappel de fin d'année (31 décembre à 23:30)
SELECT cron.schedule(
  'yearly-report-notification',
  '30 23 31 12 *',
  $$INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (NULL, '🗓 Rapport annuel disponible — Téléchargez votre fichier Excel depuis l''onglet Rapports.', 'report', false, now());$$
);

-- ============================================================
-- 5. INSERT initial : résumé des articles ajoutés aujourd'hui
--    (au cas où la table ait déjà des articles créés aujourd'hui)
-- ============================================================
INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
SELECT
  NULL,
  '📦 ' || COALESCE(p.display_name, 'Quelqu''un') || ' a ajouté l''article "' || COALESCE(a.designation, 'Sans nom') || '" aujourd''hui',
  'new_article',
  false,
  now()
FROM public.articles a
LEFT JOIN public.profiles p ON p.id = a.created_by
WHERE a.created_at::date = CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.type = 'new_article'
      AND n.created_at::date = CURRENT_DATE
      AND n.message LIKE '%' || COALESCE(a.designation, '') || '%'
  );

NOTIFY pgrst, 'reload schema';
