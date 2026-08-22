-- =====================================================
-- NEWSLETTERS (contenu édité par l'admin)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.newsletters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject    TEXT NOT NULL DEFAULT '',
  content    JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated all" ON public.newsletters
  FOR ALL USING (auth.role() = 'authenticated');

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'newsletters' ORDER BY ordinal_position;
