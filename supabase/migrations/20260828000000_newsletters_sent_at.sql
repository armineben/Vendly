-- =====================================================
-- NEWSLETTERS : suivi d'envoi
-- =====================================================

ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'newsletters' ORDER BY ordinal_position;
