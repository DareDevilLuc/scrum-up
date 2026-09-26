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

    router.replace('/dashboard')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-900">
    <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-surface-800 p-8 shadow-md flex flex-col gap-6">
      <div class="text-center">
        <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-0">Welcome!</h1>
        <p class="mt-1 text-sm text-surface-500">
          Signed in as
          <span class="font-medium text-surface-700 dark:text-surface-200">{{ auth.user?.email }}</span>.
          Choose a display name to continue.
        </p>
      </div>

      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <div class="flex flex-col gap-2">
        <label for="display-name" class="text-sm font-medium text-surface-700 dark:text-surface-200">
          Display name
        </label>
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
        :loading="loading"
        :disabled="!displayName.trim()"
        class="w-full"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>
