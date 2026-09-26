<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Avatar from 'primevue/avatar'
import { supabase } from '@/lib/supabase'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  projectId: string
  sprintId: string | null
  repoFullName: string
}>()

// ── Types ─────────────────────────────────────────────────────────────────────

interface GitHubCommit {
  sha: string
  message: string
  author: string
  author_avatar: string | null
  url: string
  date: string
}

interface GitHubPR {
  number: number
  title: string
  user: string
  user_avatar: string | null
  url: string
  merged_at: string
}

interface GitHubIssue {
  number: number
  title: string
  user: string
  user_avatar: string | null
  url: string
  closed_at: string
}

interface FeedData {
  commits: GitHubCommit[]
  pull_requests: GitHubPR[]
  issues: GitHubIssue[]
}

// ── State ─────────────────────────────────────────────────────────────────────

type TabKey = 'commits' | 'prs' | 'issues'
const activeTab = ref<TabKey>('commits')
const loading = ref(false)
const error = ref<string | null>(null)
const data = ref<FeedData | null>(null)

// ── Computed helpers ──────────────────────────────────────────────────────────

const commitCount = computed(() => data.value?.commits.length ?? 0)
const prCount = computed(() => data.value?.pull_requests.length ?? 0)
const issueCount = computed(() => data.value?.issues.length ?? 0)

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function refresh() {
  if (!props.sprintId) {
    error.value = 'Select a sprint to load GitHub activity.'
    return
  }
  loading.value = true
  error.value = null
  try {
    const { data: result, error: fnError } = await supabase.functions.invoke(
      'fetch-github-data',
      {
        body: {
          project_id: props.projectId,
          sprint_id: props.sprintId,
        },
      },
    )

    if (fnError) throw new Error(fnError.message)
    data.value = result as FeedData
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function avatarInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="feed">
    <!-- Header row -->
    <div class="feed-header">
      <div class="tab-bar">
        <button
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'commits' }"
          @click="activeTab = 'commits'"
        >
          <i class="pi pi-code" />
          Commits
          <span v-if="data" class="tab-count">{{ commitCount }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'prs' }"
          @click="activeTab = 'prs'"
        >
          <i class="pi pi-share-alt" />
          Pull Requests
          <span v-if="data" class="tab-count">{{ prCount }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'issues' }"
          @click="activeTab = 'issues'"
        >
          <i class="pi pi-exclamation-circle" />
          Issues
          <span v-if="data" class="tab-count">{{ issueCount }}</span>
        </button>
      </div>
      <Button
        icon="pi pi-refresh"
        size="small"
        text
        :loading="loading"
        title="Refresh from GitHub"
        @click="refresh"
      />
    </div>

    <!-- Repo label -->
    <div class="repo-badge">
      <i class="pi pi-github" />
      <a :href="`https://github.com/${repoFullName}`" target="_blank" rel="noopener">{{ repoFullName }}</a>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="centered">
      <ProgressSpinner style="width: 32px; height: 32px" />
    </div>

    <!-- Error -->
    <Message v-else-if="error" severity="error" :closable="false" class="feed-msg">
      {{ error }}
    </Message>

    <!-- Empty (not yet fetched) -->
    <div v-else-if="!data" class="empty-prompt">
      <i class="pi pi-arrow-circle-up empty-icon" />
      <p>Click <strong>Refresh</strong> to load GitHub activity for the selected sprint.</p>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Commits tab -->
      <div v-if="activeTab === 'commits'" class="item-list">
        <div v-if="data.commits.length === 0" class="empty-text">No commits in this sprint window.</div>
        <a
          v-for="commit in data.commits"
          :key="commit.sha"
          :href="commit.url"
          target="_blank"
          rel="noopener"
          class="feed-item"
        >
          <Avatar
            v-if="commit.author_avatar"
            :image="commit.author_avatar"
            shape="circle"
            size="normal"
          />
          <Avatar
            v-else
            :label="avatarInitials(commit.author)"
            shape="circle"
            size="normal"
            class="avatar-fallback"
          />
          <div class="item-body">
            <span class="item-title">{{ commit.message }}</span>
            <span class="item-meta">
              <span class="item-sha">{{ commit.sha }}</span>
              &middot; {{ commit.author }}
              &middot; {{ formatDate(commit.date) }}
            </span>
          </div>
          <i class="pi pi-external-link item-link-icon" />
        </a>
      </div>

      <!-- Pull Requests tab -->
      <div v-if="activeTab === 'prs'" class="item-list">
        <div v-if="data.pull_requests.length === 0" class="empty-text">No merged PRs in this sprint window.</div>
        <a
          v-for="pr in data.pull_requests"
          :key="pr.number"
          :href="pr.url"
          target="_blank"
          rel="noopener"
          class="feed-item"
        >
          <Avatar
            v-if="pr.user_avatar"
            :image="pr.user_avatar"
            shape="circle"
            size="normal"
          />
          <Avatar
            v-else
            :label="avatarInitials(pr.user)"
            shape="circle"
            size="normal"
            class="avatar-fallback"
          />
          <div class="item-body">
            <span class="item-title">{{ pr.title }}</span>
            <span class="item-meta">
              #{{ pr.number }} &middot; {{ pr.user }} &middot; merged {{ formatDate(pr.merged_at) }}
            </span>
          </div>
          <i class="pi pi-external-link item-link-icon" />
        </a>
      </div>

      <!-- Issues tab -->
      <div v-if="activeTab === 'issues'" class="item-list">
        <div v-if="data.issues.length === 0" class="empty-text">No closed issues in this sprint window.</div>
        <a
          v-for="issue in data.issues"
          :key="issue.number"
          :href="issue.url"
          target="_blank"
          rel="noopener"
          class="feed-item"
        >
          <Avatar
            v-if="issue.user_avatar"
            :image="issue.user_avatar"
            shape="circle"
            size="normal"
          />
          <Avatar
            v-else
            :label="avatarInitials(issue.user)"
            shape="circle"
            size="normal"
            class="avatar-fallback"
          />
          <div class="item-body">
            <span class="item-title">{{ issue.title }}</span>
            <span class="item-meta">
              #{{ issue.number }} &middot; {{ issue.user }} &middot; closed {{ formatDate(issue.closed_at) }}
            </span>
          </div>
          <i class="pi pi-external-link item-link-icon" />
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.feed {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tab-bar {
  display: flex;
  gap: 0.25rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--su-text-muted);
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  background: rgba(124, 58, 237, 0.1);
  color: var(--su-purple-300);
}

.tab-btn--active {
  background: rgba(124, 58, 237, 0.18);
  color: var(--su-purple-300);
  border-color: rgba(124, 58, 237, 0.4);
}

.tab-count {
  background: rgba(124, 58, 237, 0.3);
  color: var(--su-purple-300);
  border-radius: 999px;
  font-size: 0.68rem;
  padding: 0.05rem 0.4rem;
  font-weight: 600;
}

.repo-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--su-text-muted);
}

.repo-badge i {
  font-size: 0.85rem;
}

.repo-badge a {
  color: var(--su-purple-300);
  text-decoration: none;
}

.repo-badge a:hover {
  text-decoration: underline;
}

.centered {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0;
}

.feed-msg {
  margin: 0;
}

.empty-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  color: var(--su-text-muted);
  font-size: 0.85rem;
  text-align: center;
}

.empty-icon {
  font-size: 1.6rem;
  color: var(--su-border-glow);
}

.empty-text {
  color: var(--su-text-muted);
  font-size: 0.82rem;
  padding: 1rem 0;
  text-align: center;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 320px;
  overflow-y: auto;
}

.feed-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--su-border);
  background: var(--su-bg-elevated);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}

.feed-item:hover {
  border-color: var(--su-border-glow);
  background: rgba(124, 58, 237, 0.08);
}

.item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.item-title {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--su-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 0.72rem;
  color: var(--su-text-muted);
}

.item-sha {
  font-family: monospace;
  font-size: 0.7rem;
  background: rgba(124, 58, 237, 0.15);
  color: var(--su-purple-300);
  border-radius: 3px;
  padding: 0 0.3rem;
}

.item-link-icon {
  font-size: 0.7rem;
  color: var(--su-text-muted);
  flex-shrink: 0;
}

:deep(.avatar-fallback .p-avatar) {
  background: rgba(124, 58, 237, 0.25) !important;
  color: var(--su-purple-300) !important;
  font-size: 0.65rem !important;
}
</style>
