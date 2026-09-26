<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const error = ref<string | null>(null)

async function handleGitHubSignIn() {
  loading.value = true
  error.value = null
  try {
    await auth.signInWithGitHub()
    // Browser is redirected to GitHub — nothing else to do here.
  } catch (e) {
    error.value = (e as Error).message
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-900">
    <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-surface-800 p-8 shadow-md flex flex-col gap-6">
      <div class="text-center">
        <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-0">Scrum-Up</h1>
        <p class="mt-1 text-sm text-surface-500">Sign in to continue</p>
      </div>

      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <!--
        GitHub OAuth scopes configured in Supabase dashboard → Auth → Providers → GitHub:
          read:user  — access public profile info
          repo       — read/write repos for GitHub integration (Sub-Task 11)
        Make sure your GitHub OAuth App has these scopes enabled.
      -->
      <Button
        label="Sign in with GitHub"
        icon="pi pi-github"
        :loading="loading"
        class="w-full"
        @click="handleGitHubSignIn"
      />
    </div>
  </div>
</template>
