-- =====================================================
-- NOTIFICATIONS PAR UTILISATEUR + SUPPRESSION RÉELLE
-- =====================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : chacun voit SES notifications + les globales (user_id null)
DROP POLICY IF EXISTS "All authenticated read notifications" ON public.notifications;
CREATE POLICY "Read own or global notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

-- Insertion
DROP POLICY IF EXISTS "All authenticated insert notifications" ON public.notifications;
CREATE POLICY "Insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Mise à jour : chacun peut marquer SES notifications comme lues (ou les globales)
DROP POLICY IF EXISTS "All authenticated update notifications" ON public.notifications;
CREATE POLICY "Update own or global notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

-- Suppression réelle : chacun peut supprimer SES notifications (ou les globales)
DROP POLICY IF EXISTS "All authenticated delete notifications" ON public.notifications;
CREATE POLICY "Delete own or global notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
