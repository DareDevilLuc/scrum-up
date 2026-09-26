-- =============================================================================
-- Migration: 005_projects_ai_summary.sql
-- Description: Add ai_summary text column to the projects table for storing
--              a project-level AI summary generated across all sprints.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ai_summary text;
