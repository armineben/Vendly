-- =====================================================
-- Paniers en attente (Hold Carts / Tickets en suspens)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pending_carts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  total         NUMERIC DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT DEFAULT 'attente'
);

ALTER TABLE public.pending_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated all" ON public.pending_carts
  FOR ALL USING (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
