-- =============================================================
-- CMS Admin Configuration Tables & Defaults
-- =============================================================

-- 1) Site-wide key/value config (banners, texts, etc.)
CREATE TABLE IF NOT EXISTS public.site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read site_config" ON public.site_config FOR SELECT USING (true);
CREATE POLICY "Admins can insert site_config" ON public.site_config FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update site_config" ON public.site_config FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete site_config" ON public.site_config FOR DELETE USING (public.is_admin(auth.uid()));

-- 2) Promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read promo_codes" ON public.promo_codes FOR SELECT USING (true);
CREATE POLICY "Admins can insert promo_codes" ON public.promo_codes FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update promo_codes" ON public.promo_codes FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete promo_codes" ON public.promo_codes FOR DELETE USING (public.is_admin(auth.uid()));

-- 3) Add sale-price columns to articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS prix_promotionnel NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS promotion_active BOOLEAN NOT NULL DEFAULT false;

-- 4) Default config entries
INSERT INTO public.site_config (key, value) VALUES
  ('banner_type', to_jsonb('video'::text)),
  ('banner_default_video', to_jsonb('/videos/banner-video.mp4'::text)),
  ('banner_interval', to_jsonb('3000'::text)),
  ('banner_images', to_jsonb('["/images/banner1.jpg","/images/banner2.jpg","/images/banner3.jpg"]'::jsonb)),
  ('banner_videos', to_jsonb('{"homme":"/videos/Vhomme.mp4","femme":"/videos/Vfemme.mp4","enfant":"/videos/Venfents.mp4"}'::jsonb)),
  ('hero_title', to_jsonb('{"default":"Collection Exclusive","homme":"Mode Homme","femme":"Mode Femme","enfant":"Mode Enfant"}'::jsonb)),
  ('hero_subtitle', to_jsonb('{"default":"Savoir-faire et Élégance intemporelle","homme":"Élégance et raffinement","femme":"Chic et tendance","enfant":"Douceur et style"}'::jsonb)),
  ('promo_banner_text', to_jsonb(''::text)),
  ('delivery_text', to_jsonb('Livraison sécurisée à domicile ou recueil immédiat disponible dans nos points de vente partenaires. Retours gratuits sous 14 jours.'::text)),
  ('default_description', to_jsonb('Cette pièce incarne l''élégance intemporelle de notre maison. Confectionnée avec des matériaux rigoureusement sélectionnés.'::text))
ON CONFLICT (key) DO NOTHING;

-- 5) Default promo codes
INSERT INTO public.promo_codes (code, discount_type, discount_value, is_active) VALUES
  ('SOLDES20', 'percentage', 20, true),
  ('VENDLY10', 'percentage', 10, true),
  ('VIP50', 'percentage', 50, true)
ON CONFLICT (code) DO NOTHING;

-- 6) Reload schema cache
NOTIFY pgrst, 'reload schema';
