<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { supabase } from '@/lib/supabase'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  projectId: string
  isProjectHead: boolean
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const summary = ref<string | null>(null)
const loading = ref(false)
const generating = ref(false)
const error = ref<string | null>(null)

// ── Load existing summary when projectId changes ──────────────────────────────

watch(
  () => props.projectId,
  async (id) => {
    summary.value = null
    error.value = null
    if (!id) return
    loading.value = true
    try {
      const { data, error: err } = await supabase
        .from('projects')
        .select('ai_summary')
        .eq('id', id)
        .single()
      if (err) throw err
      summary.value = data?.ai_summary ?? null
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

// ── Generate ──────────────────────────────────────────────────────────────────

async function generate() {
  if (!props.projectId) return
  generating.value = true
  error.value = null
  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      'generate-sprint-summary',
      { body: { project_id: props.projectId } },
    )
    if (fnError) throw new Error(fnError.message)
    summary.value = data.summary
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="summary-panel">
    <div class="panel-header">
      <span class="panel-title">
        <i class="pi pi-sparkles title-icon" />
        AI Project Summary
      </span>
      <Button
        v-if="isProjectHead"
        :label="summary ? 'Regenerate' : 'Generate Summary'"
        icon="pi pi-refresh"
        size="small"
        text
        :loading="generating"
        @click="generate"
      />
    </div>

    <!-- Loading existing summary -->
    <div v-if="loading" class="centered">
      <ProgressSpinner style="width: 28px; height: 28px" />
    </div>

    <!-- Error -->
    <Message v-else-if="error" severity="error" :closable="false" class="panel-msg">
      {{ error }}
    </Message>

    <!-- Summary text -->
    <div v-else-if="summary" class="summary-text">{{ summary }}</div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <i class="pi pi-file-edit empty-icon" />
      <p class="empty-text">
        <template v-if="isProjectHead">
          No project summary yet. Click <strong>Generate Summary</strong> to create one with AI.
        </template>
        <template v-else>
          No AI project summary has been generated yet.
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.summary-panel {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-purple-300);
}

.title-icon {
  font-size: 0.85rem;
  color: var(--su-purple-400);
}

.centered {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.panel-msg {
  margin: 0;
}

.summary-text {
  font-size: 0.875rem;
  color: var(--su-text);
  line-height: 1.75;
  white-space: pre-wrap;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  padding: 0.85rem 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.25rem 0;
  text-align: center;
}

.empty-icon {
  font-size: 1.5rem;
  color: var(--su-border-glow);
  opacity: 0.6;
}

.empty-text {
  margin: 0;
  font-size: 0.82rem;
  color: var(--su-text-muted);
}
</style>
