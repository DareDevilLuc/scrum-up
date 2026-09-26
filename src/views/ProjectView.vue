<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useProjectsStore } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'
import type { ProjectStatus } from '@/stores/projects'

const route = useRoute()
const router = useRouter()
const projectsStore = useProjectsStore()
const authStore = useAuthStore()

const projectId = route.params.id as string

const isProjectHead = computed(() =>
  authStore.role === 'project_head' || authStore.role === 'super_admin'
)

onMounted(async () => {
  await projectsStore.fetchProjectDetail(projectId)
})

function statusSeverity(status: ProjectStatus): string {
  switch (status) {
    case 'active':    return 'success'
    case 'completed': return 'secondary'
    case 'on_hold':   return 'warn'
    case 'planning':
    default:          return 'info'
  }
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="project-view">
    <!-- Header -->
    <div class="page-header">
      <Button
        icon="pi pi-arrow-left"
        text
        @click="router.push({ name: 'projects' })"
        class="back-btn"
      />
      <div class="header-text">
        <div v-if="projectsStore.loading" class="title-skeleton" />
        <template v-else-if="projectsStore.currentProject">
          <div class="title-row">
            <h1 class="page-title">{{ projectsStore.currentProject.name }}</h1>
            <Tag
              :value="projectsStore.currentProject.status.replace('_', ' ')"
              :severity="statusSeverity(projectsStore.currentProject.status)"
              class="status-tag"
            />
          </div>
          <p class="page-subtitle">
            <span v-if="projectsStore.currentProject.team_name">
              <i class="pi pi-users" /> {{ projectsStore.currentProject.team_name }}
            </span>
            <span v-if="projectsStore.currentProject.client_name">
              &nbsp;&middot;&nbsp;<i class="pi pi-building" /> {{ projectsStore.currentProject.client_name }}
            </span>
            <span v-if="projectsStore.currentProject.start_date">
              &nbsp;&middot;&nbsp;<i class="pi pi-calendar" />
              {{ formatDate(projectsStore.currentProject.start_date) }} –
              {{ formatDate(projectsStore.currentProject.end_date) }}
            </span>
          </p>
        </template>
      </div>
    </div>

    <!-- Error -->
    <Message v-if="projectsStore.error" severity="error" :closable="false" class="mb-4">
      {{ projectsStore.error }}
    </Message>

    <!-- Loading -->
    <div v-if="projectsStore.loading" class="centered">
      <ProgressSpinner />
    </div>

    <template v-else-if="projectsStore.currentProject">
      <!-- Requirements -->
      <div v-if="projectsStore.currentProject.requirements" class="info-card">
        <h2 class="section-title">Requirements</h2>
        <p class="requirements-text">{{ projectsStore.currentProject.requirements }}</p>
      </div>

      <!-- Action tiles -->
      <div class="actions-grid">
        <!-- AI Sprint Planner — project head only -->
        <div
          v-if="isProjectHead"
          class="action-tile action-tile--primary"
          @click="router.push({ name: 'sprint-planner', params: { id: projectId } })"
        >
          <i class="pi pi-bolt action-icon" />
          <div class="action-body">
            <span class="action-title">AI Sprint Planner</span>
            <span class="action-desc">Generate a sprint plan from project requirements and team profiles</span>
          </div>
          <i class="pi pi-chevron-right action-arrow" />
        </div>

        <!-- Kanban Board (sub-task 9 — placeholder) -->
        <div class="action-tile action-tile--disabled">
          <i class="pi pi-th-large action-icon" />
          <div class="action-body">
            <span class="action-title">Kanban Board</span>
            <span class="action-desc">Track tasks across sprints</span>
          </div>
          <Tag value="coming soon" severity="secondary" class="coming-soon-tag" />
        </div>

        <!-- Metrics (sub-task 12 — placeholder) -->
        <div class="action-tile action-tile--disabled">
          <i class="pi pi-chart-bar action-icon" />
          <div class="action-body">
            <span class="action-title">Metrics &amp; Charts</span>
            <span class="action-desc">Velocity, burndown, and progress charts</span>
          </div>
          <Tag value="coming soon" severity="secondary" class="coming-soon-tag" />
        </div>

        <!-- GitHub Integration (sub-task 11 — placeholder) -->
        <div class="action-tile action-tile--disabled">
          <i class="pi pi-github action-icon" />
          <div class="action-body">
            <span class="action-title">GitHub Integration</span>
            <span class="action-desc">Link a repository and sync commits</span>
          </div>
          <Tag value="coming soon" severity="secondary" class="coming-soon-tag" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.project-view {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
  max-width: 900px;
  margin: 0 auto;
}

/* ── Header ── */
.page-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 2rem;
}
.back-btn { flex-shrink: 0; margin-top: 0.2rem; }
.header-text { flex: 1; min-width: 0; }

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.35rem;
}
.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
}
.status-tag { text-transform: capitalize; flex-shrink: 0; }
.page-subtitle {
  margin: 0;
  color: var(--su-text-muted);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.page-subtitle i { font-size: 0.75rem; }

.title-skeleton {
  height: 2rem;
  width: 260px;
  background: var(--su-bg-elevated);
  border-radius: 6px;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }

/* ── Centred spinner ── */
.centered { display: flex; justify-content: center; padding: 4rem 0; }
.mb-4 { margin-bottom: 1rem; }

/* ── Info card (requirements) ── */
.info-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 0 12px 2px rgba(124, 58, 237, 0.08);
}
.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--su-purple-300);
  margin: 0 0 0.75rem;
}
.requirements-text {
  margin: 0;
  color: var(--su-text-muted);
  font-size: 0.9rem;
  line-height: 1.7;
  white-space: pre-wrap;
}

/* ── Action tiles grid ── */
.actions-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-tile {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.action-tile--primary:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 16px 4px rgba(124, 58, 237, 0.3);
}

.action-tile--disabled {
  cursor: default;
  opacity: 0.5;
}

.action-icon {
  font-size: 1.4rem;
  color: var(--su-purple-400);
  flex-shrink: 0;
  width: 2rem;
  text-align: center;
}

.action-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.action-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--su-text);
}
.action-desc {
  font-size: 0.82rem;
  color: var(--su-text-muted);
}

.action-arrow {
  color: var(--su-text-muted);
  font-size: 0.85rem;
  flex-shrink: 0;
}

.coming-soon-tag { flex-shrink: 0; }
</style>
