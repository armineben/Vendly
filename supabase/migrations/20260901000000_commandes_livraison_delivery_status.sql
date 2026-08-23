-- =====================================================
-- ASSOUPLIR LA CONTRAINTE delivery_status_check
-- =====================================================
-- La table commandes_livraison stocke les statuts en anglais (prepared,
-- shipped, ...) utilisés par le back-office, et 'en_attente' par défaut
-- à l'insertion depuis la boutique. La contrainte actuelle ne permettait
-- que 'en_attente', bloquant les insertions "prepared".

ALTER TABLE public.commandes_livraison
  DROP CONSTRAINT IF EXISTS commandes_livraison_delivery_status_check;

ALTER TABLE public.commandes_livraison
  ADD CONSTRAINT commandes_livraison_delivery_status_check
  CHECK (delivery_status IN (
    'en_attente',
    'prepared',
    'shipped',
    'in_transit',
    'delivered',
    'paid',
    'cancelled',
    'returned'
  ));

-- Recharger le cache schéma PostgREST
NOTIFY pgrst, 'reload schema';
