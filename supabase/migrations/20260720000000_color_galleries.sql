CREATE TABLE IF NOT EXISTS public.color_galleries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  color_name   TEXT NOT NULL,
  thumbnail_url TEXT,
  images       TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, color_name)
);

ALTER TABLE public.color_galleries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all users" ON public.color_galleries FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.color_galleries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.color_galleries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON public.color_galleries FOR DELETE USING (auth.role() = 'authenticated');
