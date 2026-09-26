-- =============================================================================
-- Migration: 003_fix_sprints_tasks_rls.sql
-- Description: Fix INSERT RLS policies for sprints and tasks so that a
--              project_head with ANY scope (global, team, or project) can
--              create sprints and tasks for projects they own (created_by).
--
--              The original policies required scope_type = 'team', which
--              excluded project_heads whose role row has scope_type = 'global'
--              or scope_type = 'project', causing:
--                "new row violates row-level security policy for table sprints"
--
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

-- ── sprints ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "sprints insert for project_head" ON public.sprints;

CREATE POLICY "sprints insert for project_head"
  ON public.sprints FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if the caller is a project_head (any scope) AND is the creator
    -- of the project this sprint belongs to.
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.created_by = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
    )
  );

-- ── tasks ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks insert for project_head" ON public.tasks;

CREATE POLICY "tasks insert for project_head"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if the caller is a project_head (any scope) AND is the creator
    -- of the project that owns the sprint this task belongs to.
    EXISTS (
      SELECT 1 FROM public.sprints s
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = sprint_id
        AND p.created_by = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
    )
  );
