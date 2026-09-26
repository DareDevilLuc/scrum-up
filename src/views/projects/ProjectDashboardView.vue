<script setup lang="ts">
import { onMounted, watch, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'
import type { Sprint } from '@/stores/dashboard'
import MetricCard from '@/components/MetricCard.vue'
import LinkRepoDialog from '@/components/LinkRepoDialog.vue'
import GitHubActivityFeed from '@/components/GitHubActivityFeed.vue'
import SprintSummaryPanel from '@/components/SprintSummaryPanel.vue'
import ProjectSummaryPanel from '@/components/ProjectSummaryPanel.vue'
import BurndownChart from '@/components/charts/BurndownChart.vue'
import VelocityChart from '@/components/charts/VelocityChart.vue'
import SprintCompletionRing from '@/components/charts/SprintCompletionRing.vue'
import CommitFrequencyChart from '@/components/charts/CommitFrequencyChart.vue'
import { useSprintMetrics } from '@/composables/useSprintMetrics'
import type { VelocityPoint } from '@/components/charts/VelocityChart.vue'

const route = useRoute()
const router = useRouter()
const dashboard = useDashboardStore()
const auth = useAuthStore()

const projectId = computed(() => route.params.id as string)

const isProjectHead = computed(
  () => auth.role === 'project_head' || auth.role === 'super_admin',
)

// onMounted fires on every entry (including back-navigation) because the view
// is not wrapped in <KeepAlive>, so this naturally re-fetches after sprint confirmation.
const linkRepoVisible = ref(false)

onMounted(() => dashboard.fetchProjectOverview(projectId.value))

// Also reload when navigating between different projects without unmounting
watch(projectId, (newId) => dashboard.fetchProjectOverview(newId))

// ── Sprint metrics (reactive to currentSprint) ────────────────────────────────
const currentSprintId = computed(() => dashboard.currentSprint?.id ?? null)
const metrics = useSprintMetrics(currentSprintId)

// ── Velocity: story points completed per sprint (all sprints in project) ───────
const velocityData = computed<VelocityPoint[]>(() =>
  dashboard.sprints.map((s) => ({
    sprintName: s.name,
    storyPoints: s.completed_story_points ?? 0,
  }))
)

// Total story points in current sprint (for ideal burndown line)
const totalSprintPoints = computed(() =>
  metrics.tasks.value.reduce((sum, t) => sum + (t.story_points ?? 1), 0)
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function selectSprint(sprint: Sprint) {
  dashboard.selectSprint(sprint)
}

function onRepoLinked(_repoFullName: string, _repoUrl: string) {
  // Refresh the overview so linkedRepo state is up-to-date
  dashboard.fetchProjectOverview(projectId.value)
}

function statusSeverity(status: string): string {
  switch (status) {
    case 'active':    return 'success'
    case 'completed': return 'secondary'
    case 'on_hold':   return 'warn'
    default:          return 'info'
  }
}

function sprintStatusSeverity(status: string): string {
  switch (status) {
    case 'active':    return 'success'
    case 'completed': return 'secondary'
    default:          return 'info'
  }
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function completionPercent(sprint: Sprint): number {
  if (!sprint.task_count) return 0
  return Math.round((sprint.completed_task_count / sprint.task_count) * 100)
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}
</script>

<template>
  <div class="dashboard">

    <!-- ── Loading ─────────────────────────────────────────────────────────── -->
    <div v-if="dashboard.loading" class="centered">
      <ProgressSpinner />
    </div>

    <!-- ── Error ──────────────────────────────────────────────────────────── -->
    <Message v-else-if="dashboard.error" severity="error" :closable="false" class="mb-4">
      {{ dashboard.error }}
    </Message>

    <template v-else-if="dashboard.project">

      <!-- ── Page header ────────────────────────────────────────────────── -->
      <div class="page-header">
        <Button
          icon="pi pi-arrow-left"
          text
          class="back-btn"
          @click="router.push({ name: 'projects' })"
        />
        <div class="header-text">
          <div class="title-row">
            <h1 class="page-title">{{ dashboard.project.name }}</h1>
            <Tag
              :value="dashboard.project.status.replace('_', ' ')"
              :severity="statusSeverity(dashboard.project.status)"
              class="status-tag"
            />
          </div>
          <p class="page-subtitle">
            <span v-if="dashboard.project.team_name">
              <i class="pi pi-users" /> {{ dashboard.project.team_name }}
            </span>
            <span v-if="dashboard.project.client_name">
              &nbsp;&middot;&nbsp;<i class="pi pi-building" /> {{ dashboard.project.client_name }}
            </span>
            <span v-if="dashboard.project.start_date">
              &nbsp;&middot;&nbsp;<i class="pi pi-calendar" />
              {{ formatDate(dashboard.project.start_date) }} –
              {{ formatDate(dashboard.project.end_date) }}
            </span>
          </p>
        </div>
      </div>

      <!-- ── Body grid ──────────────────────────────────────────────────── -->
      <div class="body-grid">

        <!-- ── Left column ─────────────────────────────────────────────── -->
        <div class="left-col">

          <!-- Sprint selector -->
          <div class="section-card">
            <div class="section-heading-row">
              <h2 class="section-heading">Sprints</h2>
            </div>

            <!-- No sprints CTA -->
            <div v-if="dashboard.sprints.length === 0" class="empty-state">
              <i class="pi pi-calendar-times empty-icon" />
              <p class="empty-text">No sprints yet.</p>
              <Button
                v-if="isProjectHead"
                label="Generate Sprint Plan"
                icon="pi pi-bolt"
                class="cta-btn"
                @click="router.push({ name: 'sprint-planner', params: { id: projectId } })"
              />
            </div>

            <!-- Sprint list -->
            <div v-else class="sprint-list">
              <div
                v-for="sprint in dashboard.sprints"
                :key="sprint.id"
                class="sprint-item"
                :class="{ 'sprint-item--active': dashboard.currentSprint?.id === sprint.id }"
                @click="selectSprint(sprint)"
              >
                <div class="sprint-item-top">
                  <span class="sprint-name">{{ sprint.name }}</span>
                  <Tag
                    :value="sprint.status"
                    :severity="sprintStatusSeverity(sprint.status)"
                    class="sprint-status-tag"
                  />
                </div>
                <div class="sprint-item-meta">
                  <span>{{ formatDate(sprint.start_date) }} – {{ formatDate(sprint.end_date) }}</span>
                  <span class="sprint-tasks">{{ sprint.task_count }} tasks</span>
                </div>
                <!-- Progress bar -->
                <div class="progress-bar-track">
                  <div
                    class="progress-bar-fill"
                    :style="{ width: completionPercent(sprint) + '%' }"
                  />
                </div>
                <!-- Kanban board link -->
                <Button
                  label="Open Board"
                  icon="pi pi-table"
                  size="small"
                  text
                  class="board-btn"
                  @click.stop="router.push({ name: 'kanban', params: { id: projectId, sprintId: sprint.id } })"
                />
              </div>
            </div>
          </div>

          <!-- Team strip -->
          <div class="section-card">
            <h2 class="section-heading">Team</h2>
            <div v-if="dashboard.teamMembers.length === 0" class="empty-text-sm">
              No team members found.
            </div>
            <div v-else class="team-strip">
              <button
                v-for="member in dashboard.teamMembers"
                :key="member.user_id"
                class="team-member"
                @click="router.push({ name: 'profile', params: { userId: member.user_id } })"
              >
                <Avatar
                  v-if="member.avatar_url"
                  :image="member.avatar_url"
                  shape="circle"
                  size="large"
                />
                <Avatar
                  v-else
                  :label="initials(member.display_name)"
                  shape="circle"
                  size="large"
                  class="avatar-fallback"
                />
                <span class="member-name">{{ member.display_name }}</span>
              </button>
            </div>
          </div>

        </div>

        <!-- ── Right column — Metrics ───────────────────────────────────── -->
        <div class="right-col">

          <!-- Sprint-level metrics (shown when a sprint is selected) -->
          <template v-if="dashboard.currentSprint">
            <div class="metrics-header">
              <span class="metrics-label">Metrics — {{ dashboard.currentSprint.name }}</span>
              <ProgressSpinner v-if="metrics.loading.value" style="width:18px;height:18px" />
            </div>
            <div class="metrics-grid">
              <!-- Sprint Completion Ring -->
              <MetricCard
                title="Completion"
                :value="metrics.completionCounts.value.percent + '%'"
                icon="pi-chart-pie"
                subtitle="Done / In Progress / To Do"
              >
                <SprintCompletionRing :counts="metrics.completionCounts.value" />
              </MetricCard>

              <!-- Burndown Chart -->
              <MetricCard
                title="Burndown"
                :value="totalSprintPoints + ' pts total'"
                icon="pi-trending-down"
                subtitle="Remaining story points per day"
              >
                <BurndownChart :series="metrics.burndownSeries.value" :total-points="totalSprintPoints" />
              </MetricCard>

              <!-- Commit Frequency -->
              <MetricCard
                title="Commit Frequency"
                :value="metrics.commitsByDay.value.reduce((s, d) => s + d.count, 0) || '—'"
                icon="pi-code"
                subtitle="Commits in sprint window"
              >
                <CommitFrequencyChart :days="metrics.commitsByDay.value" />
              </MetricCard>

              <!-- Velocity (project-wide) -->
              <MetricCard
                title="Velocity"
                icon="pi-chart-bar"
                subtitle="Story points completed per sprint"
              >
                <VelocityChart :sprints="velocityData" />
              </MetricCard>
            </div>
          </template>

          <!-- No sprint selected -->
          <div v-else class="no-sprint-metrics">
            <i class="pi pi-info-circle" />
            Select a sprint to see metrics.
          </div>

          <!-- Sprint AI Summary -->
          <div class="section-card summary-card">
            <SprintSummaryPanel
              :sprint-id="dashboard.currentSprint?.id ?? null"
              :is-project-head="isProjectHead"
            />
          </div>

          <!-- GitHub repository card -->
          <div class="section-card github-card">
            <div class="section-heading-row">
              <h2 class="section-heading">GitHub Repository</h2>
              <Button
                v-if="isProjectHead"
                :label="dashboard.linkedRepo ? 'Change Repo' : 'Link Repository'"
                icon="pi pi-link"
                text
                size="small"
                @click="linkRepoVisible = true"
              />
            </div>

            <!-- No repo linked yet -->
            <div v-if="!dashboard.linkedRepo" class="github-placeholder">
              <i class="pi pi-github github-icon" />
              <span class="github-text">No repository linked yet.</span>
            </div>

            <!-- Activity feed -->
            <GitHubActivityFeed
              v-else
              :project-id="projectId"
              :sprint-id="dashboard.currentSprint?.id ?? null"
              :repo-full-name="dashboard.linkedRepo.repo_full_name"
            />
          </div>

          <!-- Link Repo Dialog -->
          <LinkRepoDialog
            v-model:visible="linkRepoVisible"
            :project-id="projectId"
            @linked="onRepoLinked"
          />

          <!-- Project AI Summary -->
          <div class="section-card summary-card">
            <ProjectSummaryPanel
              :project-id="projectId"
              :is-project-head="isProjectHead"
            />
          </div>

          <!-- AI Sprint Planner tile (project head only) -->
          <div
            v-if="isProjectHead"
            class="action-tile"
            @click="router.push({ name: 'sprint-planner', params: { id: projectId } })"
          >
            <i class="pi pi-bolt action-icon" />
            <div class="action-body">
              <span class="action-title">AI Sprint Planner</span>
              <span class="action-desc">Generate a sprint plan from project requirements and team profiles</span>
            </div>
            <i class="pi pi-chevron-right action-arrow" />
          </div>

        </div>
      </div>

    </template>

  </div>
</template>

<style scoped>
.dashboard {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Utilities ── */
.centered { display: flex; justify-content: center; padding: 4rem 0; }
.mb-4 { margin-bottom: 1rem; }

/* ── Page header ── */
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

/* ── Body grid ── */
.body-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .body-grid { grid-template-columns: 1fr; }
}

/* ── Section card ── */
.section-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 0 12px 2px rgba(124, 58, 237, 0.08);
  margin-bottom: 1.5rem;
}
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

/* ── Sprint list ── */
.sprint-list { display: flex; flex-direction: column; gap: 0.5rem; }

.sprint-item {
  all: unset;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--su-border);
  background: var(--su-bg-elevated);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.sprint-item:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 8px 2px rgba(124, 58, 237, 0.2);
}
.sprint-item--active {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 12px 3px rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.08);
}
.sprint-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.sprint-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--su-text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sprint-status-tag { flex-shrink: 0; font-size: 0.7rem; }
.sprint-item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--su-text-muted);
}
.sprint-tasks { flex-shrink: 0; }

/* ── Progress bar ── */
.progress-bar-track {
  height: 3px;
  background: var(--su-border);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.25rem;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #7c3aed, #a855f7);
  border-radius: 999px;
  transition: width 0.3s;
}

.board-btn {
  align-self: flex-start;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--su-purple-400);
}

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
}
.empty-icon { font-size: 2rem; color: var(--su-text-muted); }
.empty-text { margin: 0; color: var(--su-text-muted); font-size: 0.9rem; }
.empty-text-sm { color: var(--su-text-muted); font-size: 0.82rem; }

/* ── Team strip ── */
.team-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.team-member {
  all: unset;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.team-member:hover { opacity: 0.8; }
.member-name {
  font-size: 0.72rem;
  color: var(--su-text-muted);
  text-align: center;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.avatar-fallback .p-avatar) {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.4);
  font-weight: 700;
}

/* ── Right column ── */
.right-col { display: flex; flex-direction: column; gap: 0; }

/* ── Metrics ── */
.metrics-header {
  margin-bottom: 0.75rem;
}
.metrics-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--su-purple-300);
}
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
@media (max-width: 600px) {
  .metrics-grid { grid-template-columns: 1fr; }
}

.no-sprint-metrics {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--su-text-muted);
  font-size: 0.85rem;
  padding: 1.5rem 0;
  margin-bottom: 1.5rem;
}

/* ── Summary cards ── */
.summary-card { margin-bottom: 1rem; }

/* ── GitHub card ── */
.github-card { margin-bottom: 1rem; }
.github-placeholder {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.github-icon { font-size: 1.25rem; color: var(--su-text-muted); }
.github-text { color: var(--su-text-muted); font-size: 0.85rem; flex: 1; }

/* ── AI Sprint Planner action tile ── */
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
  margin-bottom: 1.5rem;
}
.action-tile:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 16px 4px rgba(124, 58, 237, 0.3);
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
.action-title { font-size: 0.95rem; font-weight: 700; color: var(--su-text); }
.action-desc { font-size: 0.82rem; color: var(--su-text-muted); }
.action-arrow { color: var(--su-text-muted); font-size: 0.85rem; flex-shrink: 0; }

/* ── Button helpers ── */
.cta-btn { align-self: center; }
</style>
