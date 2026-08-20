-- =====================================================
-- POLITIQUES RLS POUR ACCÈS PUBLIC À LA PAGE SHOP
-- =====================================================
-- Exécutez ce script dans l'éditeur SQL Supabase
-- pour permettre l'accès public aux données du shop

-- 1. Activer RLS sur les tables si ce n'est pas déjà fait
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE color_galleries ENABLE ROW LEVEL SECURITY;

-- 2. Créer les politiques pour permettre la lecture publique
-- ARTICLES
DROP POLICY IF EXISTS "Allow public read access on articles" ON articles;
CREATE POLICY "Allow public read access on articles"
ON articles FOR SELECT
USING (true);

-- VARIANTES
DROP POLICY IF EXISTS "Allow public read access on variantes" ON variantes;
CREATE POLICY "Allow public read access on variantes"
ON variantes FOR SELECT
USING (true);

-- COLOR_GALLERIES
DROP POLICY IF EXISTS "Allow public read access on color_galleries" ON color_galleries;
CREATE POLICY "Allow public read access on color_galleries"
ON color_galleries FOR SELECT
USING (true);

-- 3. Vérifier les politiques existantes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('articles', 'variantes', 'color_galleries');

-- 4. Tester l'accès (optionnel)
-- Cette requête devrait retourner des données si les politiques fonctionnent
SELECT COUNT(*) as article_count FROM articles;
SELECT COUNT(*) as variante_count FROM variantes;
SELECT COUNT(*) as gallery_count FROM color_galleries;