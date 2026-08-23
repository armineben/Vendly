-- =====================================================
-- CARTES CADEAUX & CODES PROMO
-- =====================================================

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount        NUMERIC NOT NULL DEFAULT 0,
  code          TEXT NOT NULL UNIQUE,
  newsletter_id UUID REFERENCES public.newsletters(id) ON DELETE SET NULL,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated all" ON public.gift_cards FOR ALL USING (auth.role() = 'authenticated');

SELECT column_name FROM information_schema.columns WHERE table_name = 'gift_cards' ORDER BY ordinal_position;