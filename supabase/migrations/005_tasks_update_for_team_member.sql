-- =============================================================================
-- Migration: 005_tasks_update_for_team_member.sql
-- Description: Allow any team member (not just assignees) to update task fields.
--
-- Problem:
--   The only UPDATE policies on tasks were "project_head" and "assignee only".
--   A developer not assigned to a task got silently blocked — Supabase returned
--   success with 0 rows updated, showing a false "saved" notification.
--
-- Fix:
--   Add a policy that allows any authenticated team member of the project to
--   update tasks within their project's sprints.
-- =============================================================================

DROP POLICY IF EXISTS "tasks update for team_member" ON public.tasks;

CREATE POLICY "tasks update for team_member"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sprints s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.team_members tm ON tm.team_id = p.team_id
      WHERE s.id = tasks.sprint_id
        AND tm.user_id = auth.uid()
    )
  );
