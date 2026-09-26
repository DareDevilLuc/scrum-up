-- =============================================================================
-- Migration: 013_fix_team_delete_policy.sql
-- Description: Fix the teams DELETE RLS policy so that any project_head with a
--              scoped user_roles row for the team can delete it, regardless of
--              whether they were the original creator (created_by). The original
--              policy required BOTH created_by = auth.uid() AND a user_roles row,
--              which blocked deletion for teams where created_by was not set to
--              the current user (e.g. imported data, admin-created teams, or teams
--              created before migration 008 was applied).
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

-- Drop the old overly-restrictive policy
DROP POLICY IF EXISTS "teams delete for project_head" ON public.teams;

-- Re-create it: only require the user_roles row (project_head scoped to this team)
-- The user_roles row is sufficient proof of ownership — it is self-assigned on
-- creation (migration 008) and only super_admin can assign it to others.
CREATE POLICY "teams delete for project_head"
  ON public.teams FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id  = auth.uid()
        AND role       = 'project_head'
        AND scope_type = 'team'
        AND scope_id   = id
    )
  );
