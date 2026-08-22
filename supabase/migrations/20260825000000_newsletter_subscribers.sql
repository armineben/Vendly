-- =====================================================
-- NEWSLETTER SUBSCRIBERS
-- =====================================================
-- Table pour les inscriptions à la newsletter (page d'accueil)

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON public.newsletter_subscribers (email);

-- RLS : tout le monde peut insérer, seuls les admins peuvent lire
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated select" ON public.newsletter_subscribers
  FOR SELECT USING (auth.role() = 'authenticated');

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'newsletter_subscribers' ORDER BY ordinal_position;