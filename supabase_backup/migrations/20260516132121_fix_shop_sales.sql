-- =============================================================
-- Fix: Add columns needed by the public shop checkout (shop.tsx)
-- The shop inserts sales as a single row with a JSON `items` array,
-- plus customer info, instead of one row per line item.
-- =============================================================

-- 1) Make article_id nullable (shop orders use items JSONB instead)
ALTER TABLE public.sales ALTER COLUMN article_id DROP NOT NULL;

-- 2) Add missing columns
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS items          JSONB,
  ADD COLUMN IF NOT EXISTS customer_name  TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS statut         TEXT DEFAULT 'complete';

-- 3) Update the stock-adjustment trigger to skip rows that carry
--    items (JSONB) — those come from the public shop which manages
--    stock itself via the `variantes` table.
DROP TRIGGER IF EXISTS trg_sales_stock ON public.sales;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Skip rows that use the JSON items column (public shop) —
  -- their stock is already deducted manually from variantes.
  IF TG_OP = 'INSERT' AND (NEW.article_id IS NULL OR NEW.items IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND (OLD.article_id IS NULL OR OLD.items IS NOT NULL) THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT quantite INTO current_stock FROM public.articles WHERE id = NEW.article_id FOR UPDATE;
    IF current_stock IS NULL THEN RAISE EXCEPTION 'Article introuvable'; END IF;
    IF current_stock < NEW.quantite THEN RAISE EXCEPTION 'Stock insuffisant'; END IF;
    UPDATE public.articles SET quantite = quantite - NEW.quantite, updated_at = now() WHERE id = NEW.article_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.articles SET quantite = quantite + OLD.quantite, updated_at = now() WHERE id = OLD.article_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sales_stock
  AFTER INSERT OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_sale();

-- 4) Force Supabase / PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
