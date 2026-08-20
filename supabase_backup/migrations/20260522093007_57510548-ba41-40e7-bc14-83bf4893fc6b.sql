
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'actif';

ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE public.articles
  ADD CONSTRAINT articles_status_check CHECK (status IN ('actif','archive','supprime'));

UPDATE public.articles SET status = 'archive' WHERE archived = true AND status = 'actif';

CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles(status);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS vendeur_nom text;
