-- =============================================================================
-- Migration: 009_team_invitations_inbox.sql
-- Description: Create the team_invitations table so invited users can see
--              and respond to pending team invitations. Also adds an RLS
--              policy allowing project_heads to insert invitations for their
--              own teams after the team already exists.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

-- =============================================
-- TABLE: team_invitations
-- =============================================
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  invited_by   uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  invited_user uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'developer'
                 CHECK (role IN ('project_head', 'developer')),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, invited_user)
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_user ON public.team_invitations (invited_user);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id      ON public.team_invitations (team_id);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- The invited user can read their own invitations
CREATE POLICY "team_invitations select for invited_user"
  ON public.team_invitations FOR SELECT
  TO authenticated
  USING ( invited_user = auth.uid() );

-- Project heads of the team can read all invitations for their team
CREATE POLICY "team_invitations select for project_head"
  ON public.team_invitations FOR SELECT
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

-- Project heads scoped to the team can insert invitations
CREATE POLICY "team_invitations insert for project_head"
  ON public.team_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
        AND scope_type = 'team'
        AND scope_id = team_id
    )
  );

-- The invited user can update status (accept/decline) on their own invitation
CREATE POLICY "team_invitations update for invited_user"
  ON public.team_invitations FOR UPDATE
  TO authenticated
  USING ( invited_user = auth.uid() )
  WITH CHECK ( invited_user = auth.uid() );

-- Super-admins can do everything
CREATE POLICY "team_invitations all for super_admin"
  ON public.team_invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- ── team_members: allow project_head to insert other users into their team ────
-- The existing "team_members insert self" policy only covers self-insert.
-- This new policy lets a project_head add any user to their own team.

CREATE POLICY "team_members insert for project_head"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
        AND scope_type = 'team'
        AND scope_id = team_id
    )
  );
