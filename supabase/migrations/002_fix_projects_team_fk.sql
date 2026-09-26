-- =============================================================================
-- Migration: 002_fix_projects_team_fk.sql
-- Description: Change projects.team_id FK from RESTRICT (default) to
--              SET NULL so that deleting a team does not block if projects
--              are still referencing it. Affected projects will have
--              team_id set to NULL instead.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_team_id_fkey;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES public.teams (id)
  ON DELETE SET NULL;
