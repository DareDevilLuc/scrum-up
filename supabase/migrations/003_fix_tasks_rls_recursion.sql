-- =============================================================================
-- Migration: 003_fix_tasks_rls_recursion.sql
-- Description: Fix "infinite recursion detected in policy for relation tasks".
--
-- Root cause — the cycle:
--   task_assignments SELECT RLS  →  queries tasks
--   tasks UPDATE RLS             →  queries task_assignments
--   → infinite loop
--
-- Fix:
--   Give task_assignments SELECT the same open policy every other lookup table
--   already uses (users, teams, team_members, sprints, projects → USING (true)).
--   This breaks the inbound cycle entirely.
--   The project-head manage policy uses a helper function to check access
--   without any STABLE/SET LOCAL conflict.
-- =============================================================================

-- ── Drop helper functions from previous fix attempts ─────────────────────────
DROP FUNCTION IF EXISTS public.is_task_assignee(uuid);
DROP FUNCTION IF EXISTS public.is_team_member_for_task(uuid);
DROP FUNCTION IF EXISTS public.is_project_head_for_task(uuid);

-- ── task_assignments SELECT: open to all authenticated users ─────────────────
DROP POLICY IF EXISTS "task_assignments select for team_member"   ON public.task_assignments;
DROP POLICY IF EXISTS "task_assignments select for authenticated" ON public.task_assignments;

CREATE POLICY "task_assignments select for authenticated"
  ON public.task_assignments FOR SELECT
  TO authenticated
  USING ( true );

-- ── Helper: project-head check for task_assignments manage policy ─────────────
-- VOLATILE (not STABLE) so PostgreSQL allows the auth.uid() call without
-- complaints about non-immutable functions in policy expressions.

CREATE OR REPLACE FUNCTION public.is_project_head_for_task(p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.sprints s  ON s.id = t.sprint_id
    JOIN public.projects p ON p.id = s.project_id
    JOIN public.user_roles ur ON ur.user_id = auth.uid()
    WHERE t.id = p_task_id
      AND ur.role = 'project_head'
      AND ur.scope_type = 'team'
      AND ur.scope_id = p.team_id
  ) INTO result;
  RETURN result;
END;
$$;

-- ── task_assignments manage: project head only ────────────────────────────────
DROP POLICY IF EXISTS "task_assignments manage for project_head" ON public.task_assignments;

CREATE POLICY "task_assignments manage for project_head"
  ON public.task_assignments FOR ALL
  TO authenticated
  USING      ( public.is_project_head_for_task(task_assignments.task_id) )
  WITH CHECK ( public.is_project_head_for_task(task_assignments.task_id) );

-- ── tasks UPDATE: assignee policy — safe now that task_assignments SELECT ─────
-- is USING (true), so querying task_assignments no longer recurses into tasks.
DROP POLICY IF EXISTS "tasks update status for assignee" ON public.tasks;

CREATE POLICY "tasks update status for assignee"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.task_assignments
      WHERE task_id = tasks.id
        AND user_id = auth.uid()
    )
  );
