-- ============================================================
-- RLS Policy: Allow authenticated users to read notifications
-- targeting 'todos'. Run this in Supabase SQL Editor.
-- ============================================================

-- Drop the overly restrictive admin-only policy if it exists
-- (only if you want users to see notifications at all)
-- DROP POLICY IF EXISTS "notifications_admin_only" ON public.notifications;

-- Add policy: users can read notifications sent to everyone
CREATE POLICY "notifications_user_read_todos" ON public.notifications
  FOR SELECT USING (
    target = 'todos' OR public.is_admin()
  );

-- Verify
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications';
