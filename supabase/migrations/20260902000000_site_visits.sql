-- =====================================================
-- COMPTEUR DE VISITES DE LA BOUTIQUE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.site_visits (
  id         INT PRIMARY KEY DEFAULT 1,
  count      INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_visits (id, count)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read site_visits" ON public.site_visits;
CREATE POLICY "Authenticated read site_visits" ON public.site_visits FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Public increment site_visits" ON public.site_visits;
CREATE POLICY "Public increment site_visits" ON public.site_visits FOR UPDATE USING (true) WITH CHECK (true);

-- RPC : incrémenter le compteur de visites
CREATE OR REPLACE FUNCTION public.increment_site_visits()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.site_visits SET count = count + 1, updated_at = now() WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.increment_site_visits() TO anon;
GRANT EXECUTE ON FUNCTION public.increment_site_visits() TO authenticated;

NOTIFY pgrst, 'reload schema';
