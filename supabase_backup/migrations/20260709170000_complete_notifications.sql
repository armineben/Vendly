-- ============================================================
-- SCRIPT COMPLET — NOTIFICATIONS, CONNEXIONS, CHAT, TRIGGERS
-- ============================================================

-- 1. TABLES DE BASE
-- ============================================================

DROP TABLE IF EXISTS public.connection_logs CASCADE;
CREATE TABLE public.connection_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  display_name TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read connection_logs"
  ON public.connection_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert connection_logs"
  ON public.connection_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP TABLE IF EXISTS public.notifications CASCADE;
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read notifications"
  ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert notifications"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated update notifications"
  ON public.notifications FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, is_read);

-- 2. COLONNE created_by SUR articles
-- ============================================================

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. receiver_id SUR chat_messages
-- ============================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_messages_participants
  ON public.chat_messages(user_id, receiver_id);

-- 4. TRIGGER : remplir created_by automatiquement à l'insertion
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

-- 5. TRIGGER : notification quand un article est ajouté
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

-- 6. TRIGGER : stock bas ≤ 3
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

DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.articles;
CREATE TRIGGER trg_notify_low_stock
  AFTER UPDATE OF quantite ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();

-- 7. TÂCHES PLANIFIÉES (pg_cron)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

SELECT cron.schedule(
  'daily-report-notification',
  '0 22 * * *',
  $$INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (NULL, '📋 Rapport journalier disponible — Téléchargez votre fichier Excel depuis l''onglet Rapports.', 'report', false, now());$$
);

SELECT cron.schedule(
  'monthly-report-notification',
  '30 23 28-31 * *',
  $$INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    SELECT NULL, '📆 Rapport mensuel disponible — Téléchargez votre fichier Excel depuis l''onglet Rapports.', 'report', false, now()
    WHERE EXTRACT(DAY FROM (CURRENT_DATE + interval '1 day')) = 1;$$
);

SELECT cron.schedule(
  'yearly-report-notification',
  '30 23 31 12 *',
  $$INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (NULL, '🗓 Rapport annuel disponible — Téléchargez votre fichier Excel depuis l''onglet Rapports.', 'report', false, now());$$
);

-- 8. INSERTS INITIAUX (rattrapage)
-- ============================================================

-- Articles déjà ≤ 3 unités
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
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.message LIKE '%' || a.designation || '%'
      AND n.type = 'low_stock'
      AND n.created_at::date = CURRENT_DATE
  );

-- Articles créés aujourd'hui
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
