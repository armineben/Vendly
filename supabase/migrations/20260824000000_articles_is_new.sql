-- =====================================================
-- NOUVEAUTÉS : colonne is_new sur la table articles
-- =====================================================
-- Exécutez ce script dans l'éditeur SQL Supabase
-- pour ajouter le statut "Nouveau produit" aux articles.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false;

-- Index pour accélérer le filtrage des nouveautés
CREATE INDEX IF NOT EXISTS idx_articles_is_new ON public.articles (is_new);

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'articles' AND column_name = 'is_new';
