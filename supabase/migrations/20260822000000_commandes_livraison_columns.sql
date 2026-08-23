-- =====================================================
-- AJOUT DES COLONNES MANQUANTES SUR commandes_livraison
-- =====================================================
-- Exécutez ce script dans l'éditeur SQL Supabase
-- pour permettre l'enregistrement complet des commandes
-- (articles, coordonnées livraison, frais, paiement)

ALTER TABLE commandes_livraison
  ADD COLUMN IF NOT EXISTS items jsonb,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_city text,
  ADD COLUMN IF NOT EXISTS client_governorate text,
  ADD COLUMN IF NOT EXISTS shipping_fees numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_notes text,
  ADD COLUMN IF NOT EXISTS courier_company text,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- Recharger le cache schéma PostgREST (élimine l'erreur "could not find column in the schema cache")
NOTIFY pgrst, 'reload schema';

-- Vérification des colonnes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'commandes_livraison'
ORDER BY ordinal_position;
