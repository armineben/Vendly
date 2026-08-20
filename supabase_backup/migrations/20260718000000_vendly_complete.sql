-- =============================================================
-- VENDLY — INSTALLATION COMPLÈTE (from scratch)
-- ⚠️ Ce script DROP toutes les tables puis recrée tout
-- =============================================================

-- ─── NETTOYAGE COMPLET ────────────────────────────────────────
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.connection_logs CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.reviews_messages CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.promo_codes CASCADE;
DROP TABLE IF EXISTS public.site_config CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.variantes CASCADE;
DROP TABLE IF EXISTS public.articles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

DROP VIEW IF EXISTS public.catalog_view CASCADE;
DROP FUNCTION IF EXISTS public.get_catalog_with_availability() CASCADE;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- =============================================================
-- 1. TYPE ÉNUMÉRÉ
-- =============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'vendeur', 'manager');

-- =============================================================
-- 2. TABLES
-- =============================================================

-- ── user_roles ──
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ── profiles ──
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  role         TEXT DEFAULT 'vendeur',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── articles ──
CREATE TABLE public.articles (
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
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT articles_status_check CHECK (status IN ('actif','archive','supprime'))
);

-- ── variantes ──
CREATE TABLE public.variantes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  taille     TEXT NOT NULL DEFAULT 'Unique',
  couleur    TEXT NOT NULL DEFAULT 'Unique',
  stock      INTEGER NOT NULL DEFAULT 0,
  image_url  TEXT
);

-- ── sales ──
CREATE TABLE public.sales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        UUID REFERENCES public.articles(id) ON DELETE RESTRICT,
  quantite          INTEGER CHECK (quantite > 0),
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
  statut            TEXT DEFAULT 'complete',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── expenses ──
CREATE TABLE public.expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motif      TEXT NOT NULL,
  montant    NUMERIC(10,2) NOT NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── site_config ──
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

-- ── promo_codes ──
CREATE TABLE public.promo_codes (
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

-- ── reservations ──
CREATE TABLE public.reservations (
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

-- ── reviews ──
CREATE TABLE public.reviews (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── questions ──
CREATE TABLE public.questions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  question    TEXT NOT NULL,
  answer      TEXT,
  answered_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── reviews_messages ──
CREATE TABLE public.reviews_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('review','message')),
  rating     INT CHECK (rating BETWEEN 1 AND 5),
  validated  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── chat_messages ──
CREATE TABLE public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── connection_logs ──
CREATE TABLE public.connection_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ── notifications ──
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================================
-- 3. INDEX
-- =============================================================
CREATE INDEX idx_articles_categorie      ON public.articles(categorie);
CREATE INDEX idx_articles_status         ON public.articles(status);
CREATE INDEX idx_articles_archived       ON public.articles(archived);
CREATE INDEX idx_articles_is_public      ON public.articles(is_public) WHERE is_public = true;
CREATE INDEX idx_sales_created_at        ON public.sales(created_at DESC);
CREATE INDEX idx_expenses_date           ON public.expenses(date DESC);
CREATE INDEX idx_reservations_status     ON public.reservations(statut);
CREATE INDEX idx_reservations_expires    ON public.reservations(date_expiration);
CREATE INDEX idx_chat_messages_created   ON public.chat_messages(created_at ASC);
CREATE INDEX idx_chat_messages_participants ON public.chat_messages(user_id, receiver_id);
CREATE INDEX idx_notifications_created   ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);

-- =============================================================
-- 4. FONCTIONS
-- =============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
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
DECLARE
  user_count INTEGER;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN assigned_role := 'admin'; ELSE assigned_role := 'vendeur'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_stock INTEGER;
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
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_article()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_display_name TEXT;
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
  GROUP BY a.id, a.reference, a.designation, a.prix_vente, a.couleur, a.description, a.taille, a.image, a.categorie, a.quantite
  HAVING (a.quantite - COALESCE((
    SELECT SUM((elem->>'quantite')::int)
    FROM public.reservations r, jsonb_array_elements(r.items) elem
    WHERE (elem->>'article_id')::uuid = a.id AND r.statut = 'en_attente' AND r.date_expiration > now()
  ), 0)) > 0;
$$;

-- =============================================================
-- 5. VUE CATALOGUE PUBLIC
-- =============================================================
CREATE VIEW public.catalog_view AS
SELECT id, reference, designation, prix_vente, couleur, description, taille, quantite, image, categorie
FROM public.articles
WHERE is_public = true AND archived = false AND quantite > 0;

-- =============================================================
-- 6. TRIGGERS
-- =============================================================
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_articles_updated ON public.articles;
  CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON public.articles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_sales_stock ON public.sales;
  CREATE TRIGGER trg_sales_stock AFTER INSERT OR DELETE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_sale();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_fill_article_created_by ON public.articles;
  CREATE TRIGGER trg_fill_article_created_by BEFORE INSERT ON public.articles
    FOR EACH ROW EXECUTE FUNCTION public.fill_article_created_by();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_notify_new_article ON public.articles;
  CREATE TRIGGER trg_notify_new_article AFTER INSERT ON public.articles
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_article();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.articles;
  CREATE TRIGGER trg_notify_low_stock AFTER UPDATE OF quantite ON public.articles
    FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================
-- 7. RLS - POLITIQUES DE SÉCURITÉ
-- =============================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles"  ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles"   ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read profiles"   ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"      ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read articles"  ON public.articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert articles"       ON public.articles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update articles"       ON public.articles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete articles"       ON public.articles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Public read published articles" ON public.articles FOR SELECT TO anon USING (is_public = true AND quantite > 0);

ALTER TABLE public.variantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated all variantes" ON public.variantes FOR ALL TO authenticated USING (true);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sales"     ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sales"   ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete sales"          ON public.sales FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read expenses"         ON public.expenses FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert expenses"       ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update expenses"       ON public.expenses FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete expenses"       ON public.expenses FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read site_config"    ON public.site_config FOR SELECT USING (true);
CREATE POLICY "Admins can insert site_config"    ON public.site_config FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update site_config"    ON public.site_config FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete site_config"    ON public.site_config FOR DELETE USING (public.is_admin(auth.uid()));

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read promo_codes"    ON public.promo_codes FOR SELECT USING (true);
CREATE POLICY "Admins can insert promo_codes"    ON public.promo_codes FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update promo_codes"    ON public.promo_codes FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete promo_codes"    ON public.promo_codes FOR DELETE USING (public.is_admin(auth.uid()));

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert reservations"        ON public.reservations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated read reservations"   ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update reservations"        ON public.reservations FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete reservations"        ON public.reservations FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.reviews_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert reviews messages"    ON public.reviews_messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read validated reviews"     ON public.reviews_messages FOR SELECT TO anon USING (type = 'review' AND validated = true);
CREATE POLICY "Authenticated read all reviews messages" ON public.reviews_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update reviews messages"    ON public.reviews_messages FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lire ses propres messages"  ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = receiver_id);
CREATE POLICY "Insérer un message"         ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read connection_logs"  ON public.connection_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert connection_logs" ON public.connection_logs FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read notifications"    ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert notifications"  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated update notifications"  ON public.notifications FOR UPDATE TO authenticated USING (true);

-- =============================================================
-- 8. GRANTS
-- =============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_stock_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT SELECT ON public.catalog_view TO anon;
GRANT EXECUTE ON FUNCTION public.get_catalog_with_availability() TO anon;

-- =============================================================
-- 9. DONNÉES INITIALES
-- =============================================================

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

INSERT INTO public.promo_codes (code, discount_type, discount_value, is_active) VALUES
  ('SOLDES20', 'percentage', 20, true),
  ('VENDLY10', 'percentage', 10, true),
  ('VIP50',    'percentage', 50, true)
ON CONFLICT (code) DO NOTHING;

-- =============================================================
-- 10. STORAGE BUCKETS
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- =============================================================
-- 11. RECHARGER LE CACHE
-- =============================================================
NOTIFY pgrst, 'reload schema';
