-- =============================================================================
-- Migration: 005_fix_task_assignments_rls.sql
-- Description: Add a direct self-select policy on task_assignments so that
--              a user can read their own assignment rows without the deep
--              join chain (tasks → sprints → projects → team_members) that
--              triggers the PostgreSQL error:
--                "SET is not allowed in a non-volatile function"
--              when PostgREST evaluates the existing policy inside a
--              STABLE-classified internal wrapper.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

CREATE POLICY "task_assignments select own"
  ON public.task_assignments FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );
