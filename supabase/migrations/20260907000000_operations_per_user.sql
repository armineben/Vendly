-- =====================================================
-- SÉPARATION DES OPÉRATIONS PAR UTILISATEUR
-- =====================================================
ALTER TABLE public.pending_carts
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Chaque utilisateur voit ses opérations (+ globales) ; l'admin voit tout
-- Le filtrage se fait côté application via created_by = auth.uid()

NOTIFY pgrst, 'reload schema';
