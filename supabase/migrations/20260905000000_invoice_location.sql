-- =====================================================
-- EMPLACEMENT DES FACTURES
-- =====================================================
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS invoice_location TEXT DEFAULT 'factures/';

NOTIFY pgrst, 'reload schema';
