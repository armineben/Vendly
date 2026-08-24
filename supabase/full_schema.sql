-- =============================================================
-- VENDLY — SCHEMA COMPLET UNIFIÉ (idempotent)
-- Peut être recollé plusieurs fois sans erreur.
-- =============================================================

-- ─── TYPE ÉNUMÉRÉ ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'vendeur', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- 1. TABLES
-- =============================================================

-- ── user_roles ──
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ── profiles ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  role         TEXT DEFAULT 'vendeur',
  phone        TEXT,
  address      TEXT,
  city         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── articles ──
CREATE TABLE IF NOT EXISTS public.articles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          TEXT NOT NULL,
  designation        TEXT NOT NULL,
  taille             TEXT,
  couleur            TEXT,
  quantite           INTEGER NOT NULL DEFAULT 0,
  prix_achat         NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_vente         NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_promotionnel  NUMERIC(10,2) DEFAULT NULL,
  promotion_active   BOOLEAN NOT NULL DEFAULT false,
  categorie          TEXT,
  emplacement        TEXT,
  image              TEXT,
  notes              TEXT,
  is_public          BOOLEAN NOT NULL DEFAULT false,
  archived           BOOLEAN NOT NULL DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'actif',
  description        TEXT,
  images             TEXT[] DEFAULT '{}',
  is_new             BOOLEAN NOT NULL DEFAULT false,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_status_check;
  ALTER TABLE public.articles ADD CONSTRAINT articles_status_check
    CHECK (status IN ('actif','archive','supprime','ok'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── variantes ──
CREATE TABLE IF NOT EXISTS public.variantes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  taille     TEXT NOT NULL DEFAULT 'Unique',
  couleur    TEXT NOT NULL DEFAULT 'Unique',
  stock      INTEGER NOT NULL DEFAULT 0,
  image_url  TEXT,
  images     TEXT[] DEFAULT '{}'
);

-- ── color_galleries ──
CREATE TABLE IF NOT EXISTS public.color_galleries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id    TEXT NOT NULL,
  product_id    TEXT,
  color_name    TEXT NOT NULL,
  hex           TEXT DEFAULT '#000000',
  thumbnail_url TEXT,
  images        TEXT[] DEFAULT '{}',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── sales ──
CREATE TABLE IF NOT EXISTS public.sales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        UUID REFERENCES public.articles(id) ON DELETE RESTRICT,
  quantite          INTEGER,
  prix_unitaire     NUMERIC(10,2),
  prix_achat_unitaire NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,
  benefice          NUMERIC(10,2) DEFAULT 0,
  vendeur_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vendeur_nom       TEXT,
  items             JSONB,
  customer_name     TEXT,
  customer_phone    TEXT,
  payment_method    TEXT,
  acompte           NUMERIC DEFAULT 0,
  statut            TEXT DEFAULT 'validee',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── expenses ──
CREATE TABLE IF NOT EXISTS public.expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motif      TEXT NOT NULL,
  montant    NUMERIC(10,2) NOT NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── site_config ──
CREATE TABLE IF NOT EXISTS public.site_config (
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

-- ── promo_codes ──
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  discount_type    TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value   NUMERIC(10,2) NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  max_uses         INTEGER DEFAULT NULL,
  current_uses     INTEGER NOT NULL DEFAULT 0,
  minimum_purchase NUMERIC(10,2) DEFAULT NULL,
  expires_at       TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── reservations (schéma final panier complet) ──
CREATE TABLE IF NOT EXISTS public.reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT,
  prenom          TEXT,
  telephone       TEXT,
  email           TEXT,
  acompte         NUMERIC DEFAULT 0,
  items           JSONB DEFAULT '[]'::jsonb,
  date_expiration TIMESTAMPTZ,
  duree_heures    INTEGER DEFAULT 24,
  delay_type      TEXT DEFAULT '24h',
  statut          TEXT DEFAULT 'en_attente',
  notes           TEXT,
  vendeur_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Colonnes héritées rendues nullable (compatibilité) — conditionnel
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='article_id') THEN
    ALTER TABLE public.reservations ALTER COLUMN article_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='client_name') THEN
    ALTER TABLE public.reservations ALTER COLUMN client_name DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='client_phone') THEN
    ALTER TABLE public.reservations ALTER COLUMN client_phone DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='status') THEN
    ALTER TABLE public.reservations ALTER COLUMN status DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='expiration_date') THEN
    ALTER TABLE public.reservations ALTER COLUMN expiration_date DROP NOT NULL;
  END IF;
END $$;

-- ── commandes_livraison (schéma final) ──
CREATE TABLE IF NOT EXISTS public.commandes_livraison (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  items             JSONB,
  client_firstname  TEXT,
  client_lastname   TEXT,
  client_phone      TEXT,
  client_email      TEXT,
  client_address    TEXT,
  client_city       TEXT,
  client_governorate TEXT,
  shipping_fees     NUMERIC DEFAULT 0,
  payment_method    TEXT,
  delivery_status   TEXT NOT NULL DEFAULT 'en_attente',
  courier_notes     TEXT,
  courier_company   TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.commandes_livraison DROP CONSTRAINT IF EXISTS commandes_livraison_delivery_status_check;
  ALTER TABLE public.commandes_livraison ADD CONSTRAINT commandes_livraison_delivery_status_check
    CHECK (delivery_status IN ('en_attente','prepared','shipped','in_transit','delivered','paid','cancelled','returned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── reviews / questions / reviews_messages ──
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.questions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  question    TEXT NOT NULL,
  answer      TEXT,
  answered_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reviews_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('review','message')),
  rating     INT CHECK (rating BETWEEN 1 AND 5),
  validated  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── chat / logs / notifications ──
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.connection_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ── Newsletter & Paniers en attente ──
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pending_carts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  total         NUMERIC DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT DEFAULT 'attente'
);

-- ── Newsletters & cartes cadeaux ──
CREATE TABLE IF NOT EXISTS public.newsletters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject    TEXT NOT NULL DEFAULT '',
  content    JSONB NOT NULL DEFAULT '[]',
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount        NUMERIC NOT NULL DEFAULT 0,
  code          TEXT NOT NULL UNIQUE,
  newsletter_id UUID REFERENCES public.newsletters(id) ON DELETE SET NULL,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Devises & zones de livraison ──
CREATE TABLE IF NOT EXISTS public.currencies (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  locale      TEXT NOT NULL,
  rate_to_tnd NUMERIC NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  TEXT NOT NULL UNIQUE,
  country_name  TEXT NOT NULL,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code) ON DELETE CASCADE,
  shipping_fee  NUMERIC NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 2. INDEX
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_articles_categorie   ON public.articles(categorie);
CREATE INDEX IF NOT EXISTS idx_articles_status      ON public.articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_archived    ON public.articles(archived);
CREATE INDEX IF NOT EXISTS idx_articles_is_public   ON public.articles(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_articles_is_new      ON public.articles(is_new);
CREATE INDEX IF NOT EXISTS idx_sales_created_at     ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date        ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_status  ON public.reservations(statut);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON public.reservations(date_expiration);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_newsletter_email     ON public.newsletter_subscribers(email);

-- =============================================================
-- 3. FONCTIONS
-- =============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INTEGER; assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN assigned_role := 'admin'; ELSE assigned_role := 'vendeur'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.adjust_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_stock INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.article_id IS NULL OR NEW.items IS NOT NULL) THEN RETURN NEW; END IF;
  IF TG_OP = 'DELETE' AND (OLD.article_id IS NULL OR OLD.items IS NOT NULL) THEN RETURN OLD; END IF;
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
CREATE OR REPLACE FUNCTION public.fill_article_created_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF; RETURN NEW; END;
$$;
CREATE OR REPLACE FUNCTION public.notify_new_article()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_display_name TEXT;
BEGIN
  SELECT COALESCE(p.display_name, 'Quelqu''un') INTO v_display_name
  FROM public.profiles p WHERE p.id = COALESCE(NEW.created_by, auth.uid());
  INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
  VALUES (NULL, '📦 ' || v_display_name || ' a ajouté l''article "' || COALESCE(NEW.designation, 'Sans nom') || '" (Réf: ' || COALESCE(NEW.reference, 'N/A') || ')', 'new_article', false, now());
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantite <= 3 AND (OLD.quantite IS NULL OR OLD.quantite > 3) THEN
    INSERT INTO public.notifications (user_id, message, type, is_read, created_at)
    VALUES (NULL, '⚠️ Alerte Stock Bas : ' || COALESCE(NEW.designation, 'Article inconnu') || ' n''a plus que ' || NEW.quantite || ' unités en stock', 'low_stock', false, now());
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_catalog_with_availability()
RETURNS TABLE (
  id UUID, reference TEXT, designation TEXT, prix_vente NUMERIC,
  couleur TEXT, description TEXT, taille TEXT, image TEXT, categorie TEXT,
  quantite_disponible INT
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.reference, a.designation, a.prix_vente, a.couleur, a.description,
         a.taille, a.image, a.categorie,
         (a.quantite - COALESCE((
            SELECT SUM((elem->>'quantite')::int)
            FROM public.reservations r, jsonb_array_elements(r.items) elem
            WHERE (elem->>'article_id')::uuid = a.id AND r.statut = 'en_attente' AND r.date_expiration > now()
         ), 0))::int AS quantite_disponible
  FROM public.articles a
  WHERE a.is_public = true AND a.archived = false
  GROUP BY a.id, a.reference, a.designation, a.prix_vente, a.couleur, a.description, a.taille, a.image, a.categorie, a.quantite;
$$;
CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.reservations
    WHERE statut = 'en_attente' AND date_expiration IS NOT NULL AND date_expiration <= now() FOR UPDATE
  LOOP
    UPDATE public.reservations SET statut = 'expiré' WHERE id = r.id;
  END LOOP;
END;
$$;

-- RPC : valider un panier (vente) avec déduction stock
CREATE OR REPLACE FUNCTION public.valider_panier_vente(
  p_vendeur_id uuid, p_items jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb; v_article_id uuid; v_variante_id uuid;
  v_quantite int; v_pu numeric; v_pa numeric; v_total numeric; v_benefice numeric;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_article_id := NULLIF(item->>'article_id','')::uuid;
    v_variante_id := NULLIF(item->>'variante_id','')::uuid;
    v_quantite := COALESCE((item->>'quantite')::int,0);
    v_pu := COALESCE((item->>'prix_unitaire')::numeric,0);
    v_pa := COALESCE((item->>'prix_achat_unitaire')::numeric,0);
    v_total := COALESCE((item->>'total')::numeric,0);
    v_benefice := (v_pu - v_pa) * v_quantite;
    INSERT INTO public.sales (article_id, quantite, prix_unitaire, prix_achat_unitaire, total, benefice, vendeur_id, vendeur_nom, statut)
    VALUES (v_article_id, v_quantite, v_pu, v_pa, v_total, v_benefice, p_vendeur_id, 'Caisse', 'validee');
    IF v_article_id IS NOT NULL THEN
      UPDATE public.articles SET quantite = GREATEST(0, COALESCE(quantite,0) - v_quantite) WHERE id = v_article_id;
    END IF;
    IF v_variante_id IS NOT NULL THEN
      UPDATE public.variantes SET stock = GREATEST(0, COALESCE(stock,0) - v_quantite) WHERE id = v_variante_id;
    END IF;
  END LOOP;
END;
$$;

-- RPC : mise à jour statut livraison
CREATE OR REPLACE FUNCTION public.update_delivery_status(p_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.commandes_livraison SET delivery_status = p_status WHERE id = p_id;
END;
$$;

-- =============================================================
-- 4. VUE CATALOGUE
-- =============================================================
CREATE OR REPLACE VIEW public.catalog_view AS
SELECT id, reference, designation, prix_vente, couleur, description, taille, quantite, image, categorie
FROM public.articles
WHERE is_public = true AND archived = false AND quantite > 0;

-- =============================================================
-- 5. TRIGGERS
-- =============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DROP TRIGGER IF EXISTS trg_articles_updated ON public.articles;
CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_sales_stock ON public.sales;
CREATE TRIGGER trg_sales_stock AFTER INSERT OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_sale();
DROP TRIGGER IF EXISTS trg_fill_article_created_by ON public.articles;
CREATE TRIGGER trg_fill_article_created_by BEFORE INSERT ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.fill_article_created_by();
DROP TRIGGER IF EXISTS trg_notify_new_article ON public.articles;
CREATE TRIGGER trg_notify_new_article AFTER INSERT ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_article();
DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.articles;
CREATE TRIGGER trg_notify_low_stock AFTER UPDATE OF quantite ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

-- =============================================================
-- 6. RLS
-- =============================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
CREATE POLICY "Authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users manage their own profile" ON public.profiles;
CREATE POLICY "Users manage their own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read published articles" ON public.articles;
CREATE POLICY "Public read published articles" ON public.articles FOR SELECT TO anon USING (is_public = true AND quantite > 0);
DROP POLICY IF EXISTS "Authenticated read articles" ON public.articles;
CREATE POLICY "Authenticated read articles" ON public.articles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage articles" ON public.articles;
CREATE POLICY "Admins manage articles" ON public.articles FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.variantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read variantes" ON public.variantes;
CREATE POLICY "Public read variantes" ON public.variantes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated all variantes" ON public.variantes;
CREATE POLICY "Authenticated all variantes" ON public.variantes FOR ALL TO authenticated USING (true);

ALTER TABLE public.color_galleries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture publique color_galleries" ON public.color_galleries;
CREATE POLICY "Lecture publique color_galleries" ON public.color_galleries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion totale color_galleries" ON public.color_galleries;
CREATE POLICY "Gestion totale color_galleries" ON public.color_galleries FOR ALL USING (true);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert sales" ON public.sales;
CREATE POLICY "Public insert sales" ON public.sales FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated read sales" ON public.sales;
CREATE POLICY "Authenticated read sales" ON public.sales FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert sales" ON public.sales;
CREATE POLICY "Authenticated insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins delete sales" ON public.sales;
CREATE POLICY "Admins delete sales" ON public.sales FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins all expenses" ON public.expenses;
CREATE POLICY "Admins all expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read site_config" ON public.site_config;
CREATE POLICY "Everyone can read site_config" ON public.site_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage site_config" ON public.site_config;
CREATE POLICY "Admins manage site_config" ON public.site_config FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read promo_codes" ON public.promo_codes;
CREATE POLICY "Everyone can read promo_codes" ON public.promo_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage promo_codes" ON public.promo_codes;
CREATE POLICY "Admins manage promo_codes" ON public.promo_codes FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert reservations" ON public.reservations;
CREATE POLICY "Public insert reservations" ON public.reservations FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated read reservations" ON public.reservations;
CREATE POLICY "Authenticated read reservations" ON public.reservations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert reservations" ON public.reservations;
CREATE POLICY "Authenticated insert reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins update reservations" ON public.reservations;
CREATE POLICY "Admins update reservations" ON public.reservations FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins delete reservations" ON public.reservations;
CREATE POLICY "Admins delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.commandes_livraison ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert commandes" ON public.commandes_livraison;
CREATE POLICY "Public insert commandes" ON public.commandes_livraison FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated read commandes" ON public.commandes_livraison;
CREATE POLICY "Authenticated read commandes" ON public.commandes_livraison FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert commandes" ON public.commandes_livraison;
CREATE POLICY "Authenticated insert commandes" ON public.commandes_livraison FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins update commandes" ON public.commandes_livraison;
CREATE POLICY "Admins update commandes" ON public.commandes_livraison FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins delete commandes" ON public.commandes_livraison;
CREATE POLICY "Admins delete commandes" ON public.commandes_livraison FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert reviews" ON public.reviews;
CREATE POLICY "Public insert reviews" ON public.reviews FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated read reviews" ON public.reviews;
CREATE POLICY "Authenticated read reviews" ON public.reviews FOR SELECT USING (true);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert questions" ON public.questions;
CREATE POLICY "Public insert questions" ON public.questions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated read questions" ON public.questions;
CREATE POLICY "Authenticated read questions" ON public.questions FOR SELECT USING (true);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert" ON public.newsletter_subscribers;
CREATE POLICY "Allow public insert" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated select" ON public.newsletter_subscribers;
CREATE POLICY "Allow authenticated select" ON public.newsletter_subscribers FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.pending_carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated all" ON public.pending_carts;
CREATE POLICY "Authenticated all" ON public.pending_carts FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated all newsletters" ON public.newsletters;
CREATE POLICY "Authenticated all newsletters" ON public.newsletters FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated all gift_cards" ON public.gift_cards;
CREATE POLICY "Authenticated all gift_cards" ON public.gift_cards FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read currencies" ON public.currencies;
CREATE POLICY "Public read currencies" ON public.currencies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated write currencies" ON public.currencies;
CREATE POLICY "Authenticated write currencies" ON public.currencies FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read shipping_zones" ON public.shipping_zones;
CREATE POLICY "Public read shipping_zones" ON public.shipping_zones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated write shipping_zones" ON public.shipping_zones;
CREATE POLICY "Authenticated write shipping_zones" ON public.shipping_zones FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lire ses propres messages" ON public.chat_messages;
CREATE POLICY "Lire ses propres messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Insérer un message" ON public.chat_messages;
CREATE POLICY "Insérer un message" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated read connection_logs" ON public.connection_logs;
CREATE POLICY "All authenticated read connection_logs" ON public.connection_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "All authenticated insert connection_logs" ON public.connection_logs;
CREATE POLICY "All authenticated insert connection_logs" ON public.connection_logs FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated read notifications" ON public.notifications;
CREATE POLICY "All authenticated read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "All authenticated insert notifications" ON public.notifications;
CREATE POLICY "All authenticated insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "All authenticated update notifications" ON public.notifications;
CREATE POLICY "All authenticated update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true);

ALTER TABLE public.reviews_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert reviews messages" ON public.reviews_messages;
CREATE POLICY "Public insert reviews messages" ON public.reviews_messages FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Public read validated reviews" ON public.reviews_messages;
CREATE POLICY "Public read validated reviews" ON public.reviews_messages FOR SELECT TO anon USING (type = 'review' AND validated = true);
DROP POLICY IF EXISTS "Authenticated read all reviews messages" ON public.reviews_messages;
CREATE POLICY "Authenticated read all reviews messages" ON public.reviews_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins update reviews messages" ON public.reviews_messages;
CREATE POLICY "Admins update reviews messages" ON public.reviews_messages FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- =============================================================
-- 7. GRANTS
-- =============================================================
GRANT SELECT ON public.catalog_view TO anon;
GRANT EXECUTE ON FUNCTION public.get_catalog_with_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.valider_panier_vente(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_delivery_status(uuid, text) TO authenticated;

-- =============================================================
-- 8. SEED (données par défaut)
-- =============================================================
INSERT INTO public.site_config (id, banner_type, video_default, video_homme, video_femme, video_enfant,
  title_default, title_homme, title_femme, title_enfant,
  subtitle_default, subtitle_homme, subtitle_femme, subtitle_enfant,
  delivery_text, default_description)
VALUES (
  'main', 'video',
  '/videos/banner-video.mp4', '/videos/Vhomme.mp4', '/videos/Vfemme.mp4', '/videos/Venfant.mp4',
  'Collection Exclusive', 'Mode Homme', 'Mode Femme', 'Mode Enfant',
  'Savoir-faire et Élégance intemporelle', 'Élégance et raffinement', 'Chic et tendance', 'Douceur et style',
  'Livraison sécurisée à domicile ou recueil immédiat disponible dans nos points de vente partenaires. Retours gratuits sous 14 jours.',
  'Cette pièce incarne l''élégance intemporelle de notre maison.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.promo_codes (code, discount_type, discount_value, is_active) VALUES
  ('SOLDES20', 'percentage', 20, true),
  ('VENDLY10', 'percentage', 10, true),
  ('VIP50',    'percentage', 50, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.currencies (code, name, symbol, locale, rate_to_tnd) VALUES
  ('TND', 'Dinar Tunisien', 'DT', 'fr-TN', 1),
  ('EUR', 'Euro', '€', 'fr-FR', 0.29)
ON CONFLICT (code) DO UPDATE SET rate_to_tnd = EXCLUDED.rate_to_tnd;

INSERT INTO public.shipping_zones (country_code, country_name, currency_code, shipping_fee) VALUES
  ('TN', 'Tunisie', 'TND', 8),
  ('FR', 'France', 'EUR', 12)
ON CONFLICT (country_code) DO UPDATE SET shipping_fee = EXCLUDED.shipping_fee;

-- =============================================================
-- 9. STORAGE BUCKETS
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('banners', 'banners', true),
       ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Public upload banners" ON storage.objects;
CREATE POLICY "Public upload banners"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners');
DROP POLICY IF EXISTS "Public read banners" ON storage.objects;
CREATE POLICY "Public read banners"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'banners');

-- =============================================================
-- 10. RECHARGER LE CACHE
-- =============================================================
NOTIFY pgrst, 'reload schema';
