ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_articles_archived ON public.articles(archived);