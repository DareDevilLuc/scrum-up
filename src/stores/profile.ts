import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GithubRepo {
  name: string
  full_name: string
  url: string
  description: string | null
  stars: number
  language: string | null
}

export interface DeveloperProfile {
  id: string
  bio: string | null
  tech_stack: string[] | null
  experience_years: number | null
  portfolio_url: string | null
  github_repos: GithubRepo[] | null
  languages: Record<string, number> | null
  // joined from users table
  display_name: string | null
  avatar_url: string | null
  github_username: string | null
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useProfileStore = defineStore('profile', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const profile = ref<DeveloperProfile | null>(null)
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetch a developer profile by user ID.
   * Joins with the users table to include display_name, avatar_url, github_username.
   */
  async function fetchProfile(userId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('developer_profiles')
        .select(`
          id,
          bio,
          tech_stack,
          experience_years,
          portfolio_url,
          github_repos,
          languages,
          users (
            display_name,
            avatar_url,
            github_username
          )
        `)
        .eq('id', userId)
        .single()

      if (sbError) throw sbError

      const user = (data as Record<string, unknown>).users as {
        display_name: string | null
        avatar_url: string | null
        github_username: string | null
      } | null

      profile.value = {
        id: data.id as string,
        bio: data.bio as string | null,
        tech_stack: data.tech_stack as string[] | null,
        experience_years: data.experience_years as number | null,
        portfolio_url: data.portfolio_url as string | null,
        github_repos: data.github_repos as GithubRepo[] | null,
        languages: data.languages as Record<string, number> | null,
        display_name: user?.display_name ?? null,
        avatar_url: user?.avatar_url ?? null,
        github_username: user?.github_username ?? null,
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /**
   * Update manually editable fields: tech_stack, experience_years, portfolio_url.
   */
  async function updateProfile(
    userId: string,
    fields: Pick<DeveloperProfile, 'tech_stack' | 'experience_years' | 'portfolio_url'>,
  ) {
    error.value = null
    const { error: sbError } = await supabase
      .from('developer_profiles')
      .update(fields)
      .eq('id', userId)

    if (sbError) {
      error.value = sbError.message
      return false
    }

    if (profile.value) {
      profile.value.tech_stack = fields.tech_stack
      profile.value.experience_years = fields.experience_years
      profile.value.portfolio_url = fields.portfolio_url
    }
    return true
  }

  /**
   * Invoke the sync-github-profile Edge Function to re-pull GitHub data.
   */
  async function syncFromGitHub(userId: string) {
    syncing.value = true
    error.value = null
    try {
      const { error: fnError } = await supabase.functions.invoke('sync-github-profile', {
        body: { user_id: userId },
      })
      if (fnError) throw fnError
      // Re-fetch to pick up the newly synced data
      await fetchProfile(userId)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      syncing.value = false
    }
  }

  return { profile, loading, syncing, error, fetchProfile, updateProfile, syncFromGitHub }
})
