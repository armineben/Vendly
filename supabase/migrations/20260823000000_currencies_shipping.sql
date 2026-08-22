-- =====================================================
-- MULTI-DEVISES & ZONES DE LIVRAISON
-- =====================================================
-- Exécutez ce script dans l'éditeur SQL Supabase
-- Tables : currencies (taux de change) + shipping_zones (frais par pays)

-- 1. TABLE CURRENCIES
CREATE TABLE IF NOT EXISTS public.currencies (
  code        TEXT PRIMARY KEY,          -- 'TND', 'EUR'
  name        TEXT NOT NULL,             -- 'Dinar Tunisien', 'Euro'
  symbol      TEXT NOT NULL,             -- 'DT', '€'
  locale      TEXT NOT NULL,             -- 'fr-TN', 'fr-FR'
  rate_to_tnd NUMERIC NOT NULL DEFAULT 1,-- 1 TND = X (dans cette devise)
  is_active   BOOLEAN NOT NULL DEFAULT true
);

-- 2. TABLE SHIPPING_ZONES
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  TEXT NOT NULL UNIQUE,    -- 'TN', 'FR'
  country_name  TEXT NOT NULL,           -- 'Tunisie', 'France'
  currency_code TEXT NOT NULL REFERENCES public.currencies(code) ON DELETE CASCADE,
  shipping_fee  NUMERIC NOT NULL DEFAULT 0, -- frais dans la devise de la zone
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read currencies" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "Authenticated write currencies" ON public.currencies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Public read shipping_zones" ON public.shipping_zones FOR SELECT USING (true);
CREATE POLICY "Authenticated write shipping_zones" ON public.shipping_zones FOR ALL USING (auth.role() = 'authenticated');

-- 4. SEED (données par défaut)
INSERT INTO public.currencies (code, name, symbol, locale, rate_to_tnd)
VALUES
  ('TND', 'Dinar Tunisien', 'DT', 'fr-TN', 1),
  ('EUR', 'Euro', '€', 'fr-FR', 0.29)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      symbol = EXCLUDED.symbol,
      locale = EXCLUDED.locale,
      rate_to_tnd = EXCLUDED.rate_to_tnd;

INSERT INTO public.shipping_zones (country_code, country_name, currency_code, shipping_fee)
VALUES
  ('TN', 'Tunisie', 'TND', 8),
  ('FR', 'France', 'EUR', 12)
ON CONFLICT (country_code) DO UPDATE
  SET country_name = EXCLUDED.country_name,
      currency_code = EXCLUDED.currency_code,
      shipping_fee = EXCLUDED.shipping_fee;

-- 5. VÉRIFICATION
SELECT * FROM public.currencies ORDER BY code;
SELECT * FROM public.shipping_zones ORDER BY country_code;
