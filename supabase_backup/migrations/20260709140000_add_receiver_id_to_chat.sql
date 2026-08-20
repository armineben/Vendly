-- ============================================================
-- ADD receiver_id TO chat_messages FOR PRIVATE MESSAGING
-- ============================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_messages_participants
  ON public.chat_messages(user_id, receiver_id);

NOTIFY pgrst, 'reload schema';
