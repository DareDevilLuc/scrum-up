<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Avatar from 'primevue/avatar'
import { useDashboardStore } from '@/stores/dashboard'
import type { Sprint, SprintStatus } from '@/stores/dashboard'
import MetricCard from '@/components/MetricCard.vue'

const route = useRoute()
const router = useRouter()
const dashboard = useDashboardStore()

const projectId = route.params.id as string

onMounted(async () => {
  await dashboard.fetchProjectOverview(projectId)
})

// Reload task counts whenever the route param changes (navigating between projects)
watch(() => route.params.id, async (newId) => {
  if (newId && newId !== projectId) {
    await dashboard.fetchProjectOverview(newId as string)
  }
})

const statusUpdating = ref(false)
const statusError = ref<string | null>(null)

function selectSprint(sprint: Sprint) {
  dashboard.selectSprint(sprint)
}

async function changeSprintStatus(sprint: Sprint, status: SprintStatus) {
  statusUpdating.value = true
  statusError.value = null
  try {
    await dashboard.updateSprintStatus(sprint.id, status)
  } catch (e) {
    statusError.value = (e as Error).message
  } finally {
    statusUpdating.value = false
  }
}

function sprintSeverity(status: Sprint['status']): string {
  switch (status) {
    case 'active': return 'success'
    case 'completed': return 'secondary'
    case 'planned':
    default: return 'info'
  }
}

function statusSeverity(status: string): string {
  switch (status) {
    case 'active': return 'success'
    case 'completed': return 'secondary'
    case 'on_hold': return 'warn'
    case 'planning':
    default: return 'info'
  }
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function goToGenerateSprints() {
  // Sub-Task 8 will wire this up to the AI sprint planner
  router.push({ name: 'project-sprint-plan', params: { id: projectId } })
}
</script>

<template>
  <div class="project-dashboard">
    <!-- Loading -->
    <div v-if="dashboard.loading && !dashboard.project" class="spinner-wrap">
      <ProgressSpinner />
    </div>

    <!-- Error -->
    <Message v-else-if="dashboard.error" severity="error" :closable="false" class="m-4">
      {{ dashboard.error }}
    </Message>

    <template v-else-if="dashboard.project">
      <!-- ── Project Header ──────────────────────────────────────────────── -->
      <div class="project-header">
        <div class="project-header__left">
          <div class="project-header__top">
            <Button
              icon="pi pi-arrow-left"
              text
              class="back-btn"
              @click="router.push({ name: 'projects' })"
            />
            <h1 class="project-title">{{ dashboard.project.name }}</h1>
            <Tag
              :value="dashboard.project.status.replace('_', ' ')"
              :severity="statusSeverity(dashboard.project.status)"
              class="status-tag"
            />
          </div>
          <div class="project-header__meta">
            <span v-if="dashboard.project.client_name" class="meta-chip">
              <i class="pi pi-building" />
              {{ dashboard.project.client_name }}
            </span>
            <span v-if="dashboard.project.team_name" class="meta-chip">
              <i class="pi pi-users" />
              {{ dashboard.project.team_name }}
            </span>
            <span v-if="dashboard.project.start_date || dashboard.project.end_date" class="meta-chip">
              <i class="pi pi-calendar" />
              {{ formatDate(dashboard.project.start_date) }} – {{ formatDate(dashboard.project.end_date) }}
            </span>
          </div>
        </div>

        <!-- GitHub repo badge -->
        <div class="repo-badge">
          <template v-if="dashboard.githubRepoName">
            <i class="pi pi-github repo-badge__icon" />
            <a
              :href="dashboard.githubRepoUrl ?? '#'"
              target="_blank"
              rel="noopener"
              class="repo-badge__name"
            >
              {{ dashboard.githubRepoName }}
            </a>
          </template>
          <template v-else>
            <Button
              label="Link Repository"
              icon="pi pi-github"
              outlined
              size="small"
              disabled
              v-tooltip="'GitHub integration coming in Sub-Task 11'"
            />
          </template>
        </div>
      </div>

      <!-- ── No Sprints CTA ─────────────────────────────────────────────── -->
      <div v-if="dashboard.hasNoSprints" class="no-sprints-banner">
        <i class="pi pi-bolt no-sprints-banner__icon" />
        <div>
          <p class="no-sprints-banner__title">No sprints yet</p>
          <p class="no-sprints-banner__subtitle">Use the AI Sprint Planner to generate a sprint plan from your project requirements.</p>
        </div>
        <Button
          v-if="dashboard.isProjectHead"
          label="Generate Sprint Plan"
          icon="pi pi-bolt"
          @click="goToGenerateSprints"
        />
      </div>

      <div v-else class="dashboard-body">
        <!-- ── Sprint Selector ───────────────────────────────────────────── -->
        <div class="sprint-selector">
          <span class="sprint-selector__label">Sprint</span>
          <div class="sprint-tabs">
            <button
              v-for="sprint in dashboard.sprints"
              :key="sprint.id"
              class="sprint-tab"
              :class="{ 'sprint-tab--active': dashboard.currentSprint?.id === sprint.id }"
              @click="selectSprint(sprint)"
            >
              <span class="sprint-tab__name">{{ sprint.name }}</span>
              <Tag
                :value="sprint.status"
                :severity="sprintSeverity(sprint.status)"
                class="sprint-tab__tag"
              />
            </button>
          </div>
        </div>

        <!-- ── Current Sprint Info ──────────────────────────────────────── -->
        <div v-if="dashboard.currentSprint" class="sprint-info">
          <p v-if="dashboard.currentSprint.goal" class="sprint-goal">
            <i class="pi pi-flag sprint-goal__icon" />
            {{ dashboard.currentSprint.goal }}
          </p>
          <div class="sprint-info__right">
            <span class="sprint-dates">
              {{ formatDate(dashboard.currentSprint.start_date) }} – {{ formatDate(dashboard.currentSprint.end_date) }}
            </span>
            <!-- Status controls — project head / super admin only -->
            <div v-if="dashboard.isProjectHead" class="sprint-status-controls">
              <Button
                v-if="dashboard.currentSprint.status === 'planned'"
                label="Start Sprint"
                icon="pi pi-play"
                size="small"
                severity="success"
                :loading="statusUpdating"
                @click="changeSprintStatus(dashboard.currentSprint, 'active')"
              />
              <Button
                v-if="dashboard.currentSprint.status === 'active'"
                label="Complete Sprint"
                icon="pi pi-check"
                size="small"
                severity="secondary"
                :loading="statusUpdating"
                @click="changeSprintStatus(dashboard.currentSprint, 'completed')"
              />
              <Button
                v-if="dashboard.currentSprint.status === 'active' || dashboard.currentSprint.status === 'completed'"
                label="Reopen"
                icon="pi pi-replay"
                size="small"
                text
                :loading="statusUpdating"
                @click="changeSprintStatus(dashboard.currentSprint, 'planned')"
              />
            </div>
          </div>
        </div>
        <Message
          v-if="statusError"
          severity="error"
          :closable="true"
          class="status-error"
          @close="statusError = null"
        >
          {{ statusError }}
        </Message>

        <!-- ── Metrics Grid ──────────────────────────────────────────────── -->
        <div class="metrics-grid">
          <MetricCard
            title="Total Tasks"
            :value="dashboard.taskCounts.total"
            icon="pi-list"
            subtitle="Tasks in this sprint"
          />
          <MetricCard
            title="Completed"
            :value="dashboard.taskCounts.done"
            icon="pi-check-circle"
            :subtitle="`${dashboard.completionPercent}% of story points done`"
          />
          <MetricCard
            title="In Progress"
            :value="dashboard.taskCounts.in_progress"
            icon="pi-spinner"
            subtitle="Currently being worked on"
          />
          <MetricCard
            title="Story Points"
            :value="`${dashboard.taskCounts.completed_points} / ${dashboard.taskCounts.total_points}`"
            icon="pi-star"
            subtitle="Completed / total"
          />
        </div>
      </div>

      <!-- ── Team Strip ────────────────────────────────────────────────── -->
      <div v-if="dashboard.teamMembers.length > 0" class="team-strip">
        <span class="team-strip__label">Team</span>
        <div class="team-strip__members">
          <RouterLink
            v-for="member in dashboard.teamMembers"
            :key="member.user_id"
            :to="{ name: 'profile', params: { userId: member.user_id } }"
            class="member-chip"
            v-tooltip.bottom="member.display_name ?? member.github_username ?? 'Unknown'"
          >
            <Avatar
              v-if="member.avatar_url"
              :image="member.avatar_url"
              shape="circle"
              size="normal"
              class="member-avatar"
            />
            <Avatar
              v-else
              :label="getInitials(member.display_name)"
              shape="circle"
              size="normal"
              class="member-avatar"
            />
            <span class="member-name">{{ member.display_name ?? member.github_username ?? 'Unknown' }}</span>
          </RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.project-dashboard {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.project-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.project-header__left {
  flex: 1;
  min-width: 0;
}

.project-header__top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.back-btn {
  flex-shrink: 0;
}

.project-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
}

.status-tag {
  text-transform: capitalize;
  flex-shrink: 0;
}

.project-header__meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-left: 2.5rem;
}

.meta-chip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--su-text-muted);
}

.meta-chip .pi {
  font-size: 0.75rem;
  color: var(--su-purple-400);
}

/* ── GitHub repo badge ───────────────────────────────────────────────────── */
.repo-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  padding: 0.5rem 0.85rem;
  flex-shrink: 0;
}

.repo-badge__icon {
  font-size: 1rem;
  color: var(--su-text-muted);
}

.repo-badge__name {
  font-size: 0.85rem;
  color: var(--su-purple-300);
  text-decoration: none;
}

.repo-badge__name:hover {
  text-decoration: underline;
}

/* ── No sprints banner ───────────────────────────────────────────────────── */
.no-sprints-banner {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border-glow);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 0 16px 4px rgba(124, 58, 237, 0.2);
}

.no-sprints-banner__icon {
  font-size: 2rem;
  color: var(--su-purple-400);
  flex-shrink: 0;
}

.no-sprints-banner__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--su-text);
  margin: 0 0 0.2rem;
}

.no-sprints-banner__subtitle {
  font-size: 0.85rem;
  color: var(--su-text-muted);
  margin: 0;
}

/* ── Sprint selector ─────────────────────────────────────────────────────── */
.sprint-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.sprint-selector__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-text-muted);
  flex-shrink: 0;
}

.sprint-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sprint-tab {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  color: var(--su-text-muted);
  font-size: 0.85rem;
}

.sprint-tab:hover {
  border-color: var(--su-border-glow);
  color: var(--su-text);
}

.sprint-tab--active {
  background: rgba(124, 58, 237, 0.15);
  border-color: var(--su-border-glow);
  color: var(--su-purple-300);
  box-shadow: 0 0 8px 1px rgba(124, 58, 237, 0.2);
}

.sprint-tab__name {
  font-weight: 600;
}

.sprint-tab__tag {
  font-size: 0.7rem;
}

/* ── Sprint info ─────────────────────────────────────────────────────────── */
.sprint-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  flex-wrap: wrap;
}

.sprint-info__right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.sprint-status-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-error {
  margin-bottom: 1rem;
}

.sprint-goal {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.875rem;
  color: var(--su-text);
  font-style: italic;
}

.sprint-goal__icon {
  color: var(--su-purple-400);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.sprint-dates {
  font-size: 0.8rem;
  color: var(--su-text-muted);
  white-space: nowrap;
}

/* ── Metrics grid ────────────────────────────────────────────────────────── */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

/* ── Team strip ──────────────────────────────────────────────────────────── */
.team-strip {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  flex-wrap: wrap;
}

.team-strip__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-text-muted);
  flex-shrink: 0;
}

.team-strip__members {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.member-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
  padding: 0.25rem 0.6rem 0.25rem 0.25rem;
  border-radius: 999px;
  border: 1px solid var(--su-border);
  background: var(--su-bg-elevated);
  transition: border-color 0.15s, background 0.15s;
}

.member-chip:hover {
  border-color: var(--su-border-glow);
  background: rgba(124, 58, 237, 0.1);
}

.member-name {
  font-size: 0.8rem;
  color: var(--su-text-muted);
}

.member-chip:hover .member-name {
  color: var(--su-purple-300);
}

:deep(.member-avatar.p-avatar) {
  width: 1.6rem !important;
  height: 1.6rem !important;
  font-size: 0.65rem !important;
}

.spinner-wrap {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.m-4 {
  margin: 1rem;
}

.dashboard-body {
  margin-bottom: 2rem;
}
</style>
