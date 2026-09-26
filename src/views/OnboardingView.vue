<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const displayName = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  const trimmed = displayName.value.trim()
  if (!trimmed) {
    error.value = 'Display name is required.'
    return
  }

  loading.value = true
  error.value = null

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    })
    if (updateError) throw updateError

    // Kick off GitHub profile sync in the background — don't block navigation
    if (auth.user?.id) {
      supabase.functions
        .invoke('sync-github-profile', { body: { user_id: auth.user.id } })
        .catch((e) => console.warn('[onboarding] profile sync failed:', e))
    }

    router.replace('/dashboard')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="onboarding-page">
    <div class="onboarding-card">
      <div class="onboarding-brand">
        <div class="brand-icon">
          <i class="pi pi-user" />
        </div>
        <h1 class="brand-name">Welcome!</h1>
        <p class="brand-sub">
          Signed in as
          <span class="brand-email">{{ auth.user?.email }}</span>.
          Choose a display name to get started.
        </p>
      </div>

      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <div class="form-field">
        <label for="display-name" class="field-label">Display name</label>
        <InputText
          id="display-name"
          v-model="displayName"
          placeholder="e.g. Jane Smith"
          class="w-full"
          :disabled="loading"
          @keyup.enter="handleSubmit"
        />
      </div>

      <Button
        label="Continue"
        icon="pi pi-arrow-right"
        :loading="loading"
        :disabled="!displayName.trim()"
        class="continue-btn"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  background: var(--su-bg);
  background-image: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124, 58, 237, 0.12) 0%, transparent 70%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.onboarding-card {
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

.onboarding-brand {
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
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 12px rgba(168, 85, 247, 0.7);
  letter-spacing: -0.02em;
}

.brand-sub {
  margin: 0;
  font-size: 0.85rem;
  color: var(--su-text-muted);
}

.brand-email {
  color: var(--su-purple-300);
  font-weight: 600;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--su-text);
}

.continue-btn {
  width: 100%;
  justify-content: center;
}
</style>
