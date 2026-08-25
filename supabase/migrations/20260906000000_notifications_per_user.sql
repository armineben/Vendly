-- =====================================================
-- NOTIFICATIONS PAR RÔLE (vendeur / admin)
-- =====================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : le vendeur ne voit que SES notifications (user_id = lui) ;
-- l'admin (présent dans user_roles) voit toutes les notifications.
DROP POLICY IF EXISTS "Read own or global notifications" ON public.notifications;
DROP POLICY IF EXISTS "All authenticated read notifications" ON public.notifications;
CREATE POLICY "Read notifications by role"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insertion
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "All authenticated insert notifications" ON public.notifications;
CREATE POLICY "Insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Mise à jour
DROP POLICY IF EXISTS "Update own or global notifications" ON public.notifications;
DROP POLICY IF EXISTS "All authenticated update notifications" ON public.notifications;
CREATE POLICY "Update notifications by role"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Suppression
DROP POLICY IF EXISTS "Delete own or global notifications" ON public.notifications;
DROP POLICY IF EXISTS "All authenticated delete notifications" ON public.notifications;
CREATE POLICY "Delete notifications by role"
  ON public.notifications FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

NOTIFY pgrst, 'reload schema';
