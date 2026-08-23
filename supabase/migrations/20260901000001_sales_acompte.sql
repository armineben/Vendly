-- =====================================================
-- AJOUT COLONNE acompte DANS sales
-- =====================================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS acompte NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';