<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useProjectsStore } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'
import type { ProjectStatus } from '@/stores/projects'

const projectsStore = useProjectsStore()
const authStore = useAuthStore()
const router = useRouter()

onMounted(async () => {
  await projectsStore.fetchMyProjects()
})

function goToProject(id: string) {
  router.push({ name: 'project-detail', params: { id } })
}

function goToCreate() {
  router.push({ name: 'project-new' })
}

const canCreateProject = () =>
  authStore.role === 'project_head' || authStore.role === 'super_admin'

function statusSeverity(status: ProjectStatus): string {
  switch (status) {
    case 'active': return 'success'
    case 'completed': return 'secondary'
    case 'on_hold': return 'warn'
    case 'planning':
    default: return 'info'
  }
}

function statusLabel(status: ProjectStatus): string {
  return status.replace('_', ' ')
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="projects-list-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Projects</h1>
        <p class="page-subtitle">Projects you are leading or contributing to.</p>
      </div>
      <Button
        v-if="canCreateProject()"
        label="New Project"
        icon="pi pi-plus"
        @click="goToCreate"
      />
    </div>

    <Message v-if="projectsStore.error" severity="error" :closable="false" class="mb-4">
      {{ projectsStore.error }}
    </Message>

    <div v-if="projectsStore.loading" class="spinner-wrap">
      <ProgressSpinner />
    </div>

    <div v-else-if="projectsStore.myProjects.length === 0" class="empty-state">
      <i class="pi pi-folder empty-icon" />
      <p>No projects found.</p>
      <p v-if="canCreateProject()" class="empty-hint">
        Get started by creating your first project.
      </p>
    </div>

    <div v-else class="projects-grid">
      <div
        v-for="project in projectsStore.myProjects"
        :key="project.id"
        class="project-card"
        @click="goToProject(project.id)"
      >
        <div class="project-card__header">
          <span class="project-card__name">{{ project.name }}</span>
          <Tag
            :value="statusLabel(project.status)"
            :severity="statusSeverity(project.status)"
            class="status-tag"
          />
        </div>

        <div class="project-card__meta">
          <div class="meta-item" v-if="project.client_name">
            <i class="pi pi-building meta-icon" />
            <span>{{ project.client_name }}</span>
          </div>
          <div class="meta-item" v-if="project.team_name">
            <i class="pi pi-users meta-icon" />
            <span>{{ project.team_name }}</span>
          </div>
          <div class="meta-item" v-if="project.start_date || project.end_date">
            <i class="pi pi-calendar meta-icon" />
            <span>{{ formatDate(project.start_date) }} – {{ formatDate(project.end_date) }}</span>
          </div>
        </div>

        <div class="project-card__footer">
          <span class="project-card__date">Created {{ formatDate(project.created_at) }}</span>
          <i class="pi pi-chevron-right project-card__arrow" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.projects-list-view {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
}

.page-subtitle {
  margin: 0;
  color: var(--su-text-muted);
  font-size: 0.9rem;
}

.spinner-wrap {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--su-text-muted);
}

.empty-icon {
  font-size: 3rem;
  color: var(--su-border-glow);
  display: block;
  margin-bottom: 1rem;
}

.empty-hint {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.project-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.project-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 16px 4px rgba(124, 58, 237, 0.35);
}

.project-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.project-card__name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--su-text);
  flex: 1;
}

.status-tag {
  text-transform: capitalize;
  white-space: nowrap;
  flex-shrink: 0;
}

.project-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--su-text-muted);
}

.meta-icon {
  font-size: 0.8rem;
  color: var(--su-purple-400);
  flex-shrink: 0;
}

.project-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.project-card__date {
  font-size: 0.8rem;
  color: var(--su-text-muted);
}

.project-card__arrow {
  color: var(--su-text-muted);
  font-size: 0.8rem;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
