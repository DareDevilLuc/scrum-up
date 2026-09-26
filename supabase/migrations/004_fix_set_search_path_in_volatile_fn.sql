-- =============================================================================
-- Migration: 004_fix_set_search_path_in_volatile_fn.sql
-- Description: Remove SET search_path from is_project_head_for_task.
--
-- Root cause:
--   PostgREST wraps every request in a transaction that sets the role to
--   "authenticated".  Inside that transaction, PostgreSQL enforces that SET
--   is not permitted in functions called from a STABLE/IMMUTABLE context —
--   even if the function itself is marked VOLATILE — because the function is
--   ultimately evaluated while building an RLS policy expression.
--   The error is: "SET is not allowed in a non-volatile function"
--
-- Fix:
--   Drop and recreate is_project_head_for_task WITHOUT the SET search_path
--   clause.  All table references inside the body are already schema-qualified
--   (public.*), so omitting SET search_path is safe.
-- =============================================================================

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
