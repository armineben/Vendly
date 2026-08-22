-- =====================================================
-- POLITIQUES RLS POUR ACCÈS PUBLIC À LA PAGE SHOP
-- =====================================================
-- Exécutez ce script dans l'éditeur SQL Supabase
-- pour permettre l'accès public aux données du shop
-- (catalogue + prise de commande)

-- ============================================
-- 1. ACTIVER RLS SUR LES TABLES (si ce n'est pas déjà fait)
-- ============================================
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE color_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes_livraison ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. LECTURE PUBLIQUE (catalogue côté client)
-- ============================================

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

-- SITE_CONFIG (bannières / config boutique)
DROP POLICY IF EXISTS "Allow public read access on site_config" ON site_config;
CREATE POLICY "Allow public read access on site_config"
ON site_config FOR SELECT
USING (true);

-- PROMO_CODES (codes promo actifs affichés en boutique)
DROP POLICY IF EXISTS "Allow public read access on promo_codes" ON promo_codes;
CREATE POLICY "Allow public read access on promo_codes"
ON promo_codes FOR SELECT
USING (true);

-- ============================================
-- 3. ÉCRITURE PUBLIQUE (checkout : commande / réservation / vente)
-- ============================================

-- COMMANDES_LIVRAISON
DROP POLICY IF EXISTS "Allow public insert on commandes_livraison" ON commandes_livraison;
CREATE POLICY "Allow public insert on commandes_livraison"
ON commandes_livraison FOR INSERT
WITH CHECK (true);

-- RESERVATIONS
DROP POLICY IF EXISTS "Allow public insert on reservations" ON reservations;
CREATE POLICY "Allow public insert on reservations"
ON reservations FOR INSERT
WITH CHECK (true);

-- SALES
DROP POLICY IF EXISTS "Allow public insert on sales" ON sales;
CREATE POLICY "Allow public insert on sales"
ON sales FOR INSERT
WITH CHECK (true);

-- QUESTIONS (Q&A produit)
DROP POLICY IF EXISTS "Allow public insert on questions" ON questions;
CREATE POLICY "Allow public insert on questions"
ON questions FOR INSERT
WITH CHECK (true);

-- REVIEWS (avis produit)
DROP POLICY IF EXISTS "Allow public insert on reviews" ON reviews;
CREATE POLICY "Allow public insert on reviews"
ON reviews FOR INSERT
WITH CHECK (true);

-- ============================================
-- 4. VÉRIFICATION DES POLITIQUES
-- ============================================
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN (
  'articles', 'variantes', 'color_galleries', 'site_config', 'promo_codes',
  'commandes_livraison', 'reservations', 'sales', 'questions', 'reviews'
)
ORDER BY tablename;

-- ============================================
-- 5. TEST DE L'ACCÈS (optionnel)
-- ============================================
SELECT COUNT(*) AS article_count FROM articles;
SELECT COUNT(*) AS variante_count FROM variantes;
SELECT COUNT(*) AS gallery_count FROM color_galleries;
