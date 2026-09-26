<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'
import { useHomeStore } from '@/stores/home'
import type { MyTask } from '@/stores/home'

const router = useRouter()
const auth = useAuthStore()
const profileStore = useProfileStore()
const projectsStore = useProjectsStore()
const homeStore = useHomeStore()

onMounted(async () => {
  const userId = auth.user?.id
  if (!userId) return
  await Promise.all([
    profileStore.fetchProfile(userId),
    projectsStore.fetchMyProjects(),
    homeStore.fetchMyTasks(userId),
  ])
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleSeverity(role: string | null): string {
  switch (role) {
    case 'super_admin':  return 'danger'
    case 'project_head': return 'warn'
    default:             return 'info'
  }
}

function roleLabel(role: string | null): string {
  switch (role) {
    case 'super_admin':  return 'Super Admin'
    case 'project_head': return 'Project Head'
    case 'developer':    return 'Developer'
    default:             return 'User'
  }
}

function statusSeverity(status: string): string {
  switch (status) {
    case 'active':    return 'success'
    case 'completed': return 'secondary'
    case 'on_hold':   return 'warn'
    default:          return 'info'
  }
}

function prioritySeverity(priority: string): string {
  switch (priority) {
    case 'critical': return 'danger'
    case 'high':     return 'danger'
    case 'medium':   return 'warn'
    default:         return 'info'
  }
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

// Group tasks by sprint name
const tasksBySprint = computed(() => {
  const map = new Map<string, { sprintName: string; projectName: string; projectId: string; sprintId: string; tasks: MyTask[] }>()
  for (const t of homeStore.myTasks) {
    const key = t.sprint_id
    if (!map.has(key)) {
      map.set(key, {
        sprintName: t.sprint_name,
        projectName: t.project_name,
        projectId: t.project_id,
        sprintId: t.sprint_id,
        tasks: [],
      })
    }
    map.get(key)!.tasks.push(t)
  }
  return Array.from(map.values())
})

const loading = computed(() => projectsStore.loading || homeStore.loading)
</script>

<template>
  <div class="home-dashboard">

    <!-- ── Welcome header ───────────────────────────────────────────────── -->
    <div class="welcome-header">
      <div class="avatar-wrap">
        <Avatar
          v-if="profileStore.profile?.avatar_url"
          :image="profileStore.profile.avatar_url"
          shape="circle"
          size="xlarge"
          class="user-avatar"
          :aria-label="`Avatar of ${profileStore.profile?.display_name ?? 'user'}`"
        />
        <Avatar
          v-else
          :label="initials(profileStore.profile?.display_name ?? auth.user?.email ?? null)"
          shape="circle"
          size="xlarge"
          class="user-avatar avatar-fallback"
          aria-hidden="true"
        />
      </div>
      <div class="welcome-text">
        <h1 class="welcome-title">
          Welcome back, {{ profileStore.profile?.display_name ?? auth.user?.email ?? 'there' }}
        </h1>
        <div class="welcome-meta">
          <Tag
            :value="roleLabel(auth.role)"
            :severity="roleSeverity(auth.role)"
          />
        </div>
      </div>
    </div>

    <!-- ── Loading ──────────────────────────────────────────────────────── -->
    <div v-if="loading" class="centered" role="status" aria-label="Loading dashboard">
      <ProgressSpinner />
    </div>

    <template v-else>

      <!-- ── My Projects ──────────────────────────────────────────────── -->
      <section class="dashboard-section" aria-labelledby="projects-heading">
        <div class="section-heading-row">
          <h2 id="projects-heading" class="section-heading">My Projects</h2>
          <Button
            label="All Projects"
            icon="pi pi-arrow-right"
            text
            size="small"
            aria-label="View all projects"
            @click="router.push({ name: 'projects' })"
          />
        </div>

        <Message v-if="projectsStore.error" severity="error" :closable="false">
          {{ projectsStore.error }}
        </Message>

        <div v-else-if="projectsStore.myProjects.length === 0" class="empty-state">
          <i class="pi pi-folder-open empty-icon" aria-hidden="true" />
          <p class="empty-text">You're not on any projects yet.</p>
          <Button
            v-if="auth.role === 'project_head' || auth.role === 'super_admin'"
            label="Create a Project"
            icon="pi pi-plus"
            size="small"
            aria-label="Create a new project"
            @click="router.push({ name: 'project-new' })"
          />
        </div>

        <div v-else class="projects-grid" role="list">
          <div
            v-for="project in projectsStore.myProjects"
            :key="project.id"
            class="project-card"
            role="listitem"
            tabindex="0"
            :aria-label="`Open project ${project.name}, status: ${project.status.replace('_', ' ')}`"
            @click="router.push({ name: 'project-detail', params: { id: project.id } })"
            @keydown.enter.space.prevent="router.push({ name: 'project-detail', params: { id: project.id } })"
          >
            <div class="project-card-top">
              <span class="project-name">{{ project.name }}</span>
              <Tag
                :value="project.status.replace('_', ' ')"
                :severity="statusSeverity(project.status)"
                class="status-tag"
              />
            </div>
            <div class="project-meta">
              <span v-if="project.team_name">
                <i class="pi pi-users" aria-hidden="true" /> {{ project.team_name }}
              </span>
              <span v-if="project.client_name">
                <i class="pi pi-building" aria-hidden="true" /> {{ project.client_name }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── My Tasks ─────────────────────────────────────────────────── -->
      <section class="dashboard-section" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" class="section-heading">My Tasks (Active Sprints)</h2>

        <Message v-if="homeStore.error" severity="error" :closable="false">
          {{ homeStore.error }}
        </Message>

        <div v-else-if="homeStore.myTasks.length === 0" class="empty-state">
          <i class="pi pi-check-circle empty-icon" aria-hidden="true" />
          <p class="empty-text">No tasks assigned to you in active sprints.</p>
        </div>

        <div v-else class="tasks-container" role="list">
          <div
            v-for="group in tasksBySprint"
            :key="group.sprintId"
            class="sprint-group"
            role="listitem"
          >
            <div class="sprint-group-header">
              <div class="sprint-group-label">
                <span class="sprint-group-project">{{ group.projectName }}</span>
                <i class="pi pi-chevron-right group-sep" aria-hidden="true" />
                <span class="sprint-group-sprint">{{ group.sprintName }}</span>
              </div>
              <Button
                label="Open Board"
                icon="pi pi-table"
                text
                size="small"
                class="open-board-btn"
                :aria-label="`Open kanban board for ${group.sprintName}`"
                @click="router.push({ name: 'kanban', params: { id: group.projectId, sprintId: group.sprintId } })"
              />
            </div>

            <div class="task-list" role="list">
              <div
                v-for="task in group.tasks"
                :key="task.id"
                class="task-row"
                role="listitem"
                :aria-label="`${task.title} — ${task.status.replace('_', ' ')}, priority: ${task.priority}`"
              >
                <div class="task-status-dot" :class="`dot-${task.status}`" :title="task.status.replace('_', ' ')" />
                <span class="task-title">{{ task.title }}</span>
                <Tag
                  :value="task.priority"
                  :severity="prioritySeverity(task.priority)"
                  class="priority-tag"
                />
                <span v-if="task.story_points" class="story-points" :aria-label="`${task.story_points} story points`">
                  {{ task.story_points }}pt
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </template>

  </div>
</template>

<style scoped>
.home-dashboard {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
  max-width: 1000px;
  margin: 0 auto;
}

@media (max-width: 600px) {
  .home-dashboard { padding: 1rem 0.75rem; }
  .welcome-title { font-size: 1.1rem; }
}

/* ── Welcome header ── */
.welcome-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
  padding: 1.5rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 16px;
  box-shadow: 0 0 20px 4px rgba(124, 58, 237, 0.1);
  flex-wrap: wrap;
}

:deep(.user-avatar.p-avatar) {
  width: 64px;
  height: 64px;
  font-size: 1.4rem;
}
:deep(.avatar-fallback.p-avatar) {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border: 2px solid rgba(124, 58, 237, 0.5);
  font-weight: 700;
}

.welcome-text { flex: 1; min-width: 0; }
.welcome-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
  margin: 0 0 0.5rem;
}
.welcome-meta { display: flex; align-items: center; gap: 0.5rem; }

/* ── Utilities ── */
.centered { display: flex; justify-content: center; padding: 4rem 0; }

/* ── Sections ── */
.dashboard-section { margin-bottom: 2.5rem; }

.section-heading {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--su-purple-300);
  margin: 0 0 1rem;
}
.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.section-heading-row .section-heading { margin-bottom: 0; }

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 0;
  background: var(--su-bg-surface);
  border: 1px dashed var(--su-border);
  border-radius: 12px;
}
.empty-icon { font-size: 2rem; color: var(--su-text-muted); }
.empty-text { margin: 0; color: var(--su-text-muted); font-size: 0.9rem; }

/* ── Projects grid ── */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.project-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.project-card:hover,
.project-card:focus-visible {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 16px 4px rgba(124, 58, 237, 0.25);
  outline: none;
}
.project-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}
.project-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--su-text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-tag { text-transform: capitalize; flex-shrink: 0; }
.project-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.78rem;
  color: var(--su-text-muted);
}
.project-meta i { font-size: 0.72rem; margin-right: 0.2rem; }

/* ── Tasks ── */
.tasks-container { display: flex; flex-direction: column; gap: 1rem; }

.sprint-group {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  overflow: hidden;
}

.sprint-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: rgba(124, 58, 237, 0.07);
  border-bottom: 1px solid var(--su-border);
  gap: 0.5rem;
}
.sprint-group-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  min-width: 0;
}
.sprint-group-project { color: var(--su-text-muted); font-weight: 600; }
.group-sep { font-size: 0.65rem; color: var(--su-text-muted); }
.sprint-group-sprint { color: var(--su-purple-300); font-weight: 700; }

.task-list { display: flex; flex-direction: column; }

.task-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--su-border);
  transition: background 0.15s;
}
.task-row:last-child { border-bottom: none; }
.task-row:hover { background: rgba(124, 58, 237, 0.05); }

/* Status dot */
.task-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-todo        { background: var(--su-text-muted); }
.dot-in_progress { background: var(--su-purple-400); box-shadow: 0 0 6px rgba(168,85,247,0.6); }
.dot-done        { background: var(--su-success); }

.task-title {
  flex: 1;
  font-size: 0.88rem;
  color: var(--su-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-tag { flex-shrink: 0; font-size: 0.7rem; }

.story-points {
  font-size: 0.72rem;
  color: var(--su-text-muted);
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
  flex-shrink: 0;
}

.open-board-btn { flex-shrink: 0; }
</style>
