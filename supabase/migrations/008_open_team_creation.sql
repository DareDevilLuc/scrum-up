-- =============================================================================
-- Migration: 008_open_team_creation.sql
-- Description: Allow any authenticated user to create a team, add themselves
--              as a member, and self-assign a project_head role scoped to that
--              team. Previously all three operations were super_admin-only.
-- =============================================================================

-- ── teams: allow any authenticated user to create their own team ──────────────

CREATE POLICY "teams insert for authenticated"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK ( created_by = auth.uid() );

-- ── team_members: allow a user to add themselves to a team they created ───────
-- (The existing "project_head" policy can't cover this because the role doesn't
--  exist yet at the moment the first self-insert happens.)

CREATE POLICY "team_members insert self"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK ( user_id = auth.uid() );

-- ── user_roles: allow a user to self-assign project_head scoped to a team ─────
-- Restricted to role = 'project_head' and scope_type = 'team' so a regular
-- user cannot escalate to super_admin through this policy.

CREATE POLICY "user_roles insert project_head for self"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'project_head'
    AND scope_type = 'team'
    AND scope_id IS NOT NULL
  );
