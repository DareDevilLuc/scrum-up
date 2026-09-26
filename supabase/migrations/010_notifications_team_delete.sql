-- =============================================================================
-- Migration: 010_notifications_team_delete.sql
-- Description: Add a notifications table for in-app messages (kick, team
--              deletion, etc.). Also adds the RLS policies that allow a
--              project_head to delete their own team and to remove members.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

-- =============================================
-- TABLE: notifications
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type       text NOT NULL,          -- e.g. 'kicked', 'team_deleted'
  title      text NOT NULL,
  body       text NOT NULL,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications select own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

-- Users can mark their own notifications read (UPDATE)
CREATE POLICY "notifications update own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

-- Project heads and super_admins can insert notifications (needed for kick/delete)
-- We allow any authenticated user to insert so the client-side kick/delete flow
-- can write notification rows for the affected members.
CREATE POLICY "notifications insert for authenticated"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK ( true );

-- Super-admins can do everything
CREATE POLICY "notifications all for super_admin"
  ON public.notifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- ── teams: allow project_head (creator) to delete their own team ─────────────

CREATE POLICY "teams delete for project_head"
  ON public.teams FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
        AND scope_type = 'team'
        AND scope_id = id
    )
  );

-- ── team_members: allow project_head to delete (kick) members from their team ─

CREATE POLICY "team_members delete for project_head"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
        AND scope_type = 'team'
        AND scope_id = team_id
    )
  );
