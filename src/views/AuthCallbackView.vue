<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const error = ref<string | null>(null)

onMounted(async () => {
  /**
   * Supabase automatically exchanges the OAuth code fragment in the URL for a
   * session via PKCE. By the time this component mounts the SDK has already
   * called onAuthStateChange (SIGNED_IN) which updates the auth store via the
   * listener registered in initialize().
   *
   * We upsert the public.users row here so that display_name, avatar_url, and
   * github_username are always up-to-date after each login.
   * github_token is written separately to user_secrets (owner-only table).
   */
  const { data, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    error.value = sessionError.message
    return
  }

  if (!data.session) {
    // No session means the OAuth exchange failed or the user cancelled.
    error.value = 'Authentication failed. Please try signing in again.'
    return
  }

  const { user, provider_token } = data.session
  const meta = user.user_metadata ?? {}

  // Upsert public profile fields and github_token into public.users.
  const { error: upsertError } = await supabase.from('users').upsert({
    id: user.id,
    display_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
    avatar_url: (meta.avatar_url as string) ?? null,
    github_username: (meta.user_name as string) ?? (meta.preferred_username as string) ?? null,
    ...(provider_token ? { github_token: provider_token } : {}),
  })

  if (upsertError) {
    // Non-fatal: log and continue — the user can still use the app.
    console.error('[callback] failed to upsert user row:', upsertError.message)
  }

  // Determine if this is a first-time login.
  // We use the absence of display_name in user_metadata as the signal that
  // onboarding hasn't been completed yet.
  const isNewUser = !meta.display_name

  if (isNewUser) {
    router.replace('/onboarding')
  } else {
    router.replace('/dashboard')
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-900">
    <Message v-if="error" severity="error" :closable="false" class="max-w-sm">
      {{ error }}
    </Message>
    <ProgressSpinner v-else />
  </div>
</template>
