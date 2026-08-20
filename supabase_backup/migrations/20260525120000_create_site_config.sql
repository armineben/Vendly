-- =============================================================
-- Migration globale : crée site_config, promo_codes,
-- reservations, et fixe les colonnes sales.
-- =============================================================

-- ─────────────────────────────────────────────
-- 1) SITE_CONFIG (single-row id = 'main')
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS public.site_config CASCADE;

CREATE TABLE public.site_config (
  id                  TEXT PRIMARY KEY DEFAULT 'main',
  banner_type         TEXT DEFAULT 'video',
  video_default       TEXT,
  video_homme         TEXT,
  video_femme         TEXT,
  video_enfant        TEXT,
  banner_interval     TEXT DEFAULT '3000',
  title_default       TEXT,
  title_homme         TEXT,
  title_femme         TEXT,
  title_enfant        TEXT,
  subtitle_default    TEXT,
  subtitle_homme      TEXT,
  subtitle_femme      TEXT,
  subtitle_enfant     TEXT,
  promo_banner_text   TEXT,
  delivery_text       TEXT,
  default_description TEXT,
  config_json         JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_config (id, banner_type, video_default, video_homme, video_femme, video_enfant,
  title_default, title_homme, title_femme, title_enfant,
  subtitle_default, subtitle_homme, subtitle_femme, subtitle_enfant,
  delivery_text, default_description)
VALUES (
  'main', 'video',
  '/videos/banner-video.mp4', '/videos/Vhomme.mp4', '/videos/Vfemme.mp4', '/videos/Venfents.mp4',
  'Collection Exclusive', 'Mode Homme', 'Mode Femme', 'Mode Enfant',
  'Savoir-faire et Élégance intemporelle', 'Élégance et raffinement', 'Chic et tendance', 'Douceur et style',
  'Livraison sécurisée à domicile ou recueil immédiat disponible dans nos points de vente partenaires. Retours gratuits sous 14 jours.',
  'Cette pièce incarne l''élégance intemporelle de notre maison.'
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read site_config" ON public.site_config FOR SELECT USING (true);
CREATE POLICY "Admins can insert site_config" ON public.site_config FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update site_config" ON public.site_config FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete site_config" ON public.site_config FOR DELETE USING (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────
-- 2) PROMO_CODES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT UNIQUE NOT NULL,
  discount_type     TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value    NUMERIC(10,2) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  max_uses          INTEGER DEFAULT NULL,
  current_uses      INTEGER NOT NULL DEFAULT 0,
  minimum_purchase  NUMERIC(10,2) DEFAULT NULL,
  expires_at        TIMESTAMPTZ DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read promo_codes" ON public.promo_codes FOR SELECT USING (true);
CREATE POLICY "Admins can insert promo_codes" ON public.promo_codes FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update promo_codes" ON public.promo_codes FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete promo_codes" ON public.promo_codes FOR DELETE USING (public.is_admin(auth.uid()));

INSERT INTO public.promo_codes (code, discount_type, discount_value, is_active) VALUES
  ('SOLDES20', 'percentage', 20, true),
  ('VENDLY10', 'percentage', 10, true),
  ('VIP50',    'percentage', 50, true)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3) SALES – fix NOT NULL columns
-- ─────────────────────────────────────────────
ALTER TABLE public.sales ALTER COLUMN quantite      DROP NOT NULL;
ALTER TABLE public.sales ALTER COLUMN quantite      DROP DEFAULT;
ALTER TABLE public.sales ALTER COLUMN prix_unitaire DROP NOT NULL;

-- ─────────────────────────────────────────────
-- 4) RESERVATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT NOT NULL DEFAULT '',
  prenom          TEXT NOT NULL DEFAULT '',
  telephone       TEXT,
  vendeur_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_expiration TIMESTAMPTZ NOT NULL,
  statut          TEXT NOT NULL DEFAULT 'en_attente',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS date_expiration TIMESTAMPTZ;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS vendeur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated read reservations" ON public.reservations FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated insert reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admins update reservations" ON public.reservations FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admins delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 5) Reload schema cache
-- ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
