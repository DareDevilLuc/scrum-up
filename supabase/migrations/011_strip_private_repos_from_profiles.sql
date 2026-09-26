-- =============================================================================
-- Migration: 011_strip_private_repos_from_profiles.sql
-- Description: Clear all stored github_repos from developer_profiles.
--
--              The sync-github-profile Edge Function previously stored private
--              repositories because it did not filter them out. The stored JSONB
--              objects do not include the GitHub "private" field (it was dropped
--              in the .map() call), so there is no reliable way to distinguish
--              which stored repos are private after the fact.
--
--              The safest fix is to wipe the cached repo list for every profile.
--              Users will see an empty Repositories card and can click
--              "Sync from GitHub" to re-populate it — the patched Edge Function
--              now filters private repos before storing.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

UPDATE public.developer_profiles
SET github_repos = NULL,
    private_github_repos = NULL
WHERE github_repos IS NOT NULL
   OR private_github_repos IS NOT NULL;
