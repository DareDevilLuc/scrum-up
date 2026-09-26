-- =============================================================================
-- Migration: 006_tasks_updated_at.sql
-- Description: Add updated_at column to tasks table and a trigger to keep it
--              current. Required by useSprintMetrics burndown calculation which
--              uses updated_at as a proxy for when a task was completed.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Back-fill existing rows with created_at as a sensible default
UPDATE public.tasks SET updated_at = created_at WHERE updated_at = now() AND created_at IS NOT NULL;

-- Trigger to auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
