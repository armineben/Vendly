-- ============================================================
-- NOTIFICATIONS & CONNECTION LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.connection_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  display_name TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read connection_logs"
  ON public.connection_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert connection_logs"
  ON public.connection_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read notifications"
  ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert notifications"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated update notifications"
  ON public.notifications FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, is_read);

NOTIFY pgrst, 'reload schema';
