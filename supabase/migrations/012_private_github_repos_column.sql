-- =============================================================================
-- Migration: 012_private_github_repos_column.sql
-- Description: Add a private_github_repos column to developer_profiles.
--              Public repos remain in github_repos (readable by all).
--              Private repos are stored here and only fetched by the owner
--              in the application query layer (same pattern as github_token
--              on the users table).
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

ALTER TABLE public.developer_profiles
  ADD COLUMN IF NOT EXISTS private_github_repos jsonb;
