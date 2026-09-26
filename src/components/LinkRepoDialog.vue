<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Props / emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'linked', repoFullName: string, repoUrl: string): void
}>()

// ── State ─────────────────────────────────────────────────────────────────────

interface RepoOption {
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  language: string | null
}

const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const repos = ref<RepoOption[]>([])
const filtered = ref<RepoOption[]>([])
const search = ref('')
const selected = ref<RepoOption | null>(null)

// ── Fetch repos on open ───────────────────────────────────────────────────────

watch(
  () => props.visible,
  async (open) => {
    if (!open) return
    selected.value = null
    search.value = ''
    error.value = null
    await loadRepos()
  },
)

async function loadRepos() {
  loading.value = true
  error.value = null
  try {
    // Read the GitHub token for the current user
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('github_token')
      .eq('id', auth.user!.id)
      .single()

    if (userError || !userRow?.github_token) {
      throw new Error('No GitHub token found. Please reconnect your GitHub account via your profile.')
    }

    // Fetch all repos (user + org) — up to 100
    const res = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc',
      {
        headers: {
          Authorization: `Bearer ${userRow.github_token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!res.ok) {
      const msg = await res.text()
      throw new Error(`GitHub API error: ${msg}`)
    }

    const raw = await res.json()
    repos.value = (Array.isArray(raw) ? raw : []).map((r: Record<string, unknown>) => ({
      full_name: r.full_name as string,
      html_url: r.html_url as string,
      description: (r.description as string) ?? null,
      private: !!r.private,
      language: (r.language as string) ?? null,
    }))
    applySearch()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function applySearch() {
  const q = search.value.trim().toLowerCase()
  filtered.value = q
    ? repos.value.filter((r) => r.full_name.toLowerCase().includes(q))
    : repos.value
}

watch(search, applySearch)

// ── Confirm link ──────────────────────────────────────────────────────────────

async function confirmLink() {
  if (!selected.value) return
  saving.value = true
  error.value = null
  try {
    const { error: upsertError } = await supabase
      .from('github_repos')
      .upsert(
        {
          project_id: props.projectId,
          repo_full_name: selected.value.full_name,
          repo_url: selected.value.html_url,
          linked_by: auth.user!.id,
        },
        { onConflict: 'project_id' },
      )

    if (upsertError) throw upsertError

    emit('linked', selected.value.full_name, selected.value.html_url)
    emit('update:visible', false)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    header="Link GitHub Repository"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="link-repo-dialog"
    :style="{ width: '520px', maxWidth: '95vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <!-- Search -->
    <div class="search-row">
      <span class="p-input-icon-left search-wrap">
        <i class="pi pi-search" />
        <InputText
          v-model="search"
          placeholder="Search repositories…"
          class="search-input"
        />
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="centered">
      <ProgressSpinner style="width: 36px; height: 36px" />
    </div>

    <!-- Error -->
    <Message v-else-if="error" severity="error" :closable="false" class="error-msg">
      {{ error }}
    </Message>

    <!-- Repo list -->
    <div v-else class="repo-list">
      <div
        v-if="filtered.length === 0"
        class="empty-text"
      >
        No repositories found.
      </div>
      <button
        v-for="repo in filtered"
        :key="repo.full_name"
        class="repo-item"
        :class="{ 'repo-item--selected': selected?.full_name === repo.full_name }"
        @click="selected = repo"
      >
        <div class="repo-main">
          <i class="pi pi-github repo-icon" />
          <div class="repo-body">
            <span class="repo-name">{{ repo.full_name }}</span>
            <span v-if="repo.description" class="repo-desc">{{ repo.description }}</span>
          </div>
        </div>
        <div class="repo-meta">
          <span v-if="repo.language" class="repo-lang">{{ repo.language }}</span>
          <span v-if="repo.private" class="repo-private">Private</span>
        </div>
      </button>
    </div>

    <!-- Footer -->
    <template #footer>
      <Button
        label="Cancel"
        text
        @click="emit('update:visible', false)"
      />
      <Button
        label="Link Repository"
        icon="pi pi-link"
        :disabled="!selected || saving"
        :loading="saving"
        @click="confirmLink"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.search-row {
  margin-bottom: 0.75rem;
}
.search-wrap {
  display: block;
  width: 100%;
}
.search-input {
  width: 100%;
}

.centered {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.error-msg {
  margin-bottom: 0.5rem;
}

.repo-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 340px;
  overflow-y: auto;
  padding-right: 2px;
}

.empty-text {
  color: var(--su-text-muted);
  font-size: 0.875rem;
  text-align: center;
  padding: 1.5rem 0;
}

.repo-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--su-border);
  background: var(--su-bg-elevated);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.repo-item:hover {
  border-color: var(--su-border-glow);
  background: rgba(124, 58, 237, 0.08);
}

.repo-item--selected {
  border-color: var(--su-border-glow);
  background: rgba(124, 58, 237, 0.15);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 10px 2px rgba(124, 58, 237, 0.25);
}

.repo-main {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.repo-icon {
  font-size: 1rem;
  color: var(--su-purple-300);
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.repo-body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.repo-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--su-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-desc {
  font-size: 0.78rem;
  color: var(--su-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-meta {
  display: flex;
  gap: 0.5rem;
  padding-left: 1.6rem;
}

.repo-lang {
  font-size: 0.72rem;
  color: var(--su-purple-300);
  background: rgba(124, 58, 237, 0.15);
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
}

.repo-private {
  font-size: 0.72rem;
  color: var(--su-text-muted);
  background: rgba(139, 122, 171, 0.1);
  border: 1px solid rgba(139, 122, 171, 0.25);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
}
</style>
