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
  } catch (e) {
    error.value = (e as Error).message
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo / Brand -->
      <div class="login-brand">
        <div class="brand-icon">
          <i class="pi pi-bolt" />
        </div>
        <h1 class="brand-name">Scrum-Up</h1>
        <p class="brand-tagline">Agile project management, supercharged.</p>
      </div>

      <Message v-if="error" severity="error" :closable="false" class="login-error">
        {{ error }}
      </Message>

      <Button
        label="Sign in with GitHub"
        icon="pi pi-github"
        :loading="loading"
        class="github-btn"
        @click="handleGitHubSignIn"
      />

      <p class="login-footer">
        By signing in you agree to use this platform responsibly.
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--su-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  /* subtle radial glow in background */
  background-image: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124, 58, 237, 0.12) 0%, transparent 70%);
}

.login-card {
  width: 100%;
  max-width: 22rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border-glow);
  border-radius: 16px;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 40px 8px rgba(124, 58, 237, 0.25);
}

.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.brand-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--su-purple-700), var(--su-purple-500));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--su-purple-200);
  box-shadow: 0 0 16px 4px rgba(124, 58, 237, 0.5);
  margin-bottom: 0.25rem;
}

.brand-name {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 12px rgba(168, 85, 247, 0.7);
  letter-spacing: -0.02em;
}

.brand-tagline {
  margin: 0;
  font-size: 0.85rem;
  color: var(--su-text-muted);
}

.login-error {
  width: 100%;
}

.github-btn {
  width: 100%;
  justify-content: center;
  font-size: 0.95rem;
  padding: 0.7rem 1rem;
}

.login-footer {
  margin: 0;
  font-size: 0.75rem;
  color: var(--su-text-muted);
  text-align: center;
  opacity: 0.7;
}
</style>
