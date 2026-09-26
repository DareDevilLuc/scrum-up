-- =============================================================================
-- Migration: 004_sprints_github_data.sql
-- Description: Add github_sprint_data JSONB column to the sprints table.
--              This column caches the result from the fetch-github-data Edge
--              Function so we avoid hammering the GitHub API on every page load.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

ALTER TABLE public.sprints
  ADD COLUMN IF NOT EXISTS github_sprint_data jsonb;
