-- =============================================================================
-- Migration: 014_fix_team_delete_rls_recursion.sql
-- Description: Fix team DELETE silently returning 0 rows despite the user
--              having a valid project_head role for the team.
--
-- Root cause: The teams DELETE policy uses an EXISTS subquery that reads
-- public.user_roles. Because user_roles has its own RLS enabled, PostgreSQL
-- may hit a policy evaluation recursion (or a security-barrier visibility
-- issue) when the subquery runs inside a DELETE policy expression, causing it
-- to return no rows and silently block the delete.
--
-- Fix: Introduce a SECURITY DEFINER helper function that reads user_roles
-- without RLS interference (same pattern used in migration 003 for tasks).
-- The teams DELETE policy then calls this function instead of embedding the
-- subquery directly.
-- =============================================================================

-- ── Helper: check if the current user is project_head for a given team ────────
CREATE OR REPLACE FUNCTION public.is_project_head_for_team(p_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id  = auth.uid()
      AND role       = 'project_head'
      AND scope_type = 'team'
      AND scope_id   = p_team_id
  ) INTO result;
  RETURN result;
END;
$$;

-- ── Re-create the teams DELETE policy using the helper ────────────────────────
DROP POLICY IF EXISTS "teams delete for project_head" ON public.teams;

CREATE POLICY "teams delete for project_head"
  ON public.teams FOR DELETE
  TO authenticated
  USING ( public.is_project_head_for_team(id) );
