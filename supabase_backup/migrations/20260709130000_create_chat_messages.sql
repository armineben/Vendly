-- ============================================================
-- TEAM CHAT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_name TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read chat_messages"
  ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert chat_messages"
  ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created
  ON public.chat_messages(created_at ASC);

NOTIFY pgrst, 'reload schema';
