import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  // ── State ────────────────────────────────────────────────────────────────
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const role = ref<string | null>(null)
  const githubToken = ref<string | null>(null)

  // Resolves once the initial getSession() + role fetch completes.
  // Guards await this before checking auth state.
  let _resolveReady!: () => void
  const _readyPromise = new Promise<void>((resolve) => { _resolveReady = resolve })

  async function waitUntilReady() {
    return _readyPromise
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Called once on app mount. Restores the session from Supabase and
   * subscribes to future auth state changes (token refresh, sign-out, etc.).
   */
  async function initialize() {
    const { data } = await supabase.auth.getSession()
    await _applySession(data.session)
    _resolveReady()

    supabase.auth.onAuthStateChange((_event: AuthChangeEvent, newSession: Session | null) => {
      _applySession(newSession)
    })
  }

  /**
   * Trigger GitHub OAuth sign-in. Supabase will redirect the browser to
   * GitHub and then back to /auth/callback with a code.
   *
   * Required GitHub OAuth scopes (set in Supabase dashboard → Auth → Providers → GitHub):
   *   read:user   — to read the user's public profile
   *   repo        — to read/write repositories for GitHub integration (Sub-Task 11)
   */
  async function signInWithGitHub() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'read:user repo',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  /**
   * Signs the user out, clears all local state, and navigates to /login
   * (the router guard handles the redirect automatically).
   */
  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
    role.value = null
    githubToken.value = null
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  async function _applySession(newSession: Session | null) {
    session.value = newSession
    user.value = newSession?.user ?? null
    // provider_token is the GitHub access token returned during OAuth
    githubToken.value = newSession?.provider_token ?? null

    // Fetch the user's highest-priority role from user_roles table.
    // Priority: super_admin > project_head > developer
    if (newSession?.user) {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', newSession.user.id)

      const rows = (rolesData ?? []).map((r: { role: string }) => r.role)
      if (rows.includes('super_admin')) {
        role.value = 'super_admin'
      } else if (rows.includes('project_head')) {
        role.value = 'project_head'
      } else if (rows.includes('developer')) {
        role.value = 'developer'
      } else {
        role.value = null
      }
    } else {
      role.value = null
    }

    // Persist the GitHub token to users table whenever it is present.
    // provider_token is only available immediately after OAuth; on subsequent
    // session restores it will be null, so we only write when non-null.
    if (newSession?.user && newSession.provider_token) {
      supabase
        .from('users')
        .update({ github_token: newSession.provider_token })
        .eq('id', newSession.user.id)
        .then(({ error }) => {
          if (error) console.error('[auth] failed to persist github_token:', error.message)
        })
    }
  }

  return { session, user, role, githubToken, initialize, waitUntilReady, signInWithGitHub, signOut }
})
