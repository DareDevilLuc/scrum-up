<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { supabase } from '@/lib/supabase'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useSprintMetrics } from '@/composables/useSprintMetrics'
import type { VelocityPoint } from '@/components/charts/VelocityChart.vue'
import SprintCompletionRing from '@/components/charts/SprintCompletionRing.vue'
import VelocityChart from '@/components/charts/VelocityChart.vue'
import SprintSummaryPanel from '@/components/SprintSummaryPanel.vue'
import type { Sprint } from '@/stores/dashboard'

// ── Router / stores ───────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const dashboard = useDashboardStore()
const auth = useAuthStore()

const projectId = computed(() => route.params.id as string)
const sprintId = computed(() => route.params.sprintId as string)

const isProjectHead = computed(
  () => auth.role === 'project_head' || auth.role === 'super_admin',
)

// ── Sprint detail ─────────────────────────────────────────────────────────────

interface SprintDetail {
  id: string
  name: string
  goal: string | null
  status: string
  start_date: string | null
  end_date: string | null
}

const sprint = ref<SprintDetail | null>(null)
const loadingSprint = ref(false)
const sprintError = ref<string | null>(null)

// GitHub highlights sourced from cached sprint data
const githubHighlights = ref<{
  top_commits: { sha: string; message: string; author: string; url: string }[]
  pr_count: number
  issues_count: number
} | null>(null)

async function fetchSprintDetail() {
  loadingSprint.value = true
  sprintError.value = null
  try {
    const { data, error } = await supabase
      .from('sprints')
      .select('id, name, goal, status, start_date, end_date, github_sprint_data')
      .eq('id', sprintId.value)
      .single()
    if (error) throw error
    sprint.value = data as SprintDetail

    // Parse GitHub highlights from cached sprint data
    const ghData = (data as any).github_sprint_data as {
      commits?: { sha: string; message: string; author: string; url: string }[]
      pull_requests?: unknown[]
      issues?: unknown[]
    } | null

    if (ghData) {
      githubHighlights.value = {
        top_commits: (ghData.commits ?? []).slice(0, 5),
        pr_count: ghData.pull_requests?.length ?? 0,
        issues_count: ghData.issues?.length ?? 0,
      }
    }
  } catch (e) {
    sprintError.value = (e as Error).message
  } finally {
    loadingSprint.value = false
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

const currentSprintId = computed(() => sprintId.value)
const metrics = useSprintMetrics(currentSprintId)

// ── Velocity comparison ───────────────────────────────────────────────────────

const velocityData = computed<VelocityPoint[]>(() =>
  dashboard.sprints.map((s: Sprint) => ({
    sprintName: s.name,
    storyPoints: s.completed_story_points ?? 0,
  })),
)

const teamAveragePoints = computed(() => {
  const completed = dashboard.sprints.filter((s: Sprint) => s.status === 'completed')
  if (!completed.length) return 0
  const total = completed.reduce((sum: number, s: Sprint) => sum + (s.completed_story_points ?? 0), 0)
  return Math.round(total / completed.length)
})

const thisSprintPoints = computed(() =>
  dashboard.sprints.find((s: Sprint) => s.id === sprintId.value)?.completed_story_points ?? 0,
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function sprintStatusSeverity(status: string): string {
  switch (status) {
    case 'active': return 'success'
    case 'completed': return 'secondary'
    default: return 'info'
  }
}

function printPage() {
  window.print()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await fetchSprintDetail()
  if (dashboard.project?.id !== projectId.value) {
    await dashboard.fetchProjectOverview(projectId.value)
  }
})

watch(sprintId, fetchSprintDetail)
</script>

<template>
  <div class="review-page">

    <!-- Loading -->
    <div v-if="loadingSprint" class="centered" role="status" aria-label="Loading sprint">
      <ProgressSpinner />
    </div>

    <Message v-else-if="sprintError" severity="error" :closable="false" class="mb-4">
      {{ sprintError }}
    </Message>

    <template v-else-if="sprint">
      <!-- ── Page header ──────────────────────────────────────────────────── -->
      <div class="page-header no-print">
        <Button
          icon="pi pi-arrow-left"
          text
          class="back-btn"
          aria-label="Back to kanban board"
          @click="router.push({ name: 'kanban', params: { id: projectId, sprintId } })"
        />
        <div class="header-content">
          <h1 class="page-title">
            <i class="pi pi-chart-bar title-icon" aria-hidden="true" />
            Sprint Review
          </h1>
          <div class="header-actions">
            <Button
              label="Retrospective"
              icon="pi pi-comments"
              text
              aria-label="Go to sprint retrospective"
              @click="router.push({ name: 'sprint-retro', params: { id: projectId, sprintId } })"
            />
            <Button
              label="Print / Export PDF"
              icon="pi pi-print"
              outlined
              aria-label="Print or export as PDF"
              @click="printPage"
            />
          </div>
        </div>
      </div>

      <!-- ── Hero section ────────────────────────────────────────────────── -->
      <div class="hero-card print-card">
        <div class="hero-top">
          <div class="hero-info">
            <div class="sprint-name">{{ sprint.name }}</div>
            <div class="sprint-dates">
              <i class="pi pi-calendar" aria-hidden="true" />
              <time v-if="sprint.start_date">{{ formatDate(sprint.start_date) }}</time>
              <span aria-hidden="true">→</span>
              <time v-if="sprint.end_date">{{ formatDate(sprint.end_date) }}</time>
            </div>
          </div>
          <Tag
            :value="sprint.status.replace('_', ' ')"
            :severity="sprintStatusSeverity(sprint.status)"
          />
        </div>
        <div v-if="sprint.goal" class="sprint-goal">
          <span class="goal-label">Goal</span>
          <span class="goal-text">{{ sprint.goal }}</span>
        </div>
      </div>

      <!-- ── Metrics grid ─────────────────────────────────────────────────── -->
      <div class="metrics-grid">

        <!-- Completion ring -->
        <div class="metric-card print-card">
          <div class="metric-label">
            <i class="pi pi-check-circle" />
            Sprint Completion
          </div>
          <div v-if="metrics.loading.value" class="centered-sm">
            <ProgressSpinner style="width:28px;height:28px" />
          </div>
          <SprintCompletionRing v-else :counts="metrics.completionCounts.value" />
          <div class="metric-sub">
            {{ metrics.completionCounts.value.done }}/{{ metrics.completionCounts.value.total }} tasks done
          </div>
        </div>

        <!-- Velocity comparison -->
        <div class="metric-card print-card">
          <div class="metric-label">
            <i class="pi pi-bolt" />
            Velocity
          </div>
          <VelocityChart :sprints="velocityData" />
          <div class="velocity-compare">
            <div class="vel-stat">
              <span class="vel-num">{{ thisSprintPoints }}</span>
              <span class="vel-sub">this sprint</span>
            </div>
            <div class="vel-divider" />
            <div class="vel-stat">
              <span class="vel-num">{{ teamAveragePoints }}</span>
              <span class="vel-sub">team avg</span>
            </div>
          </div>
        </div>

      </div>

      <!-- ── AI Summary ───────────────────────────────────────────────────── -->
      <div class="section-card print-card">
        <SprintSummaryPanel :sprint-id="sprintId" :is-project-head="isProjectHead" />
      </div>

      <!-- ── GitHub highlights ────────────────────────────────────────────── -->
      <div class="section-card print-card">
        <div class="section-title">
          <i class="pi pi-github" aria-hidden="true" />
          GitHub Highlights
        </div>

        <template v-if="githubHighlights">
          <div class="gh-stats" role="list" aria-label="GitHub statistics">
            <div class="gh-stat-chip" role="listitem">
              <i class="pi pi-share-alt" aria-hidden="true" />
              <span class="gh-stat-num" aria-label="{{ githubHighlights.pr_count }} pull requests merged">{{ githubHighlights.pr_count }}</span>
              <span class="gh-stat-lbl">PRs merged</span>
            </div>
            <div class="gh-stat-chip" role="listitem">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              <span class="gh-stat-num" aria-label="{{ githubHighlights.issues_count }} issues closed">{{ githubHighlights.issues_count }}</span>
              <span class="gh-stat-lbl">Issues closed</span>
            </div>
          </div>

          <div v-if="githubHighlights.top_commits.length" class="commits-list">
            <div class="commits-label">Top Commits</div>
            <a
              v-for="commit in githubHighlights.top_commits"
              :key="commit.sha"
              :href="commit.url"
              target="_blank"
              rel="noopener noreferrer"
              class="commit-row"
              :aria-label="`Commit ${commit.sha.slice(0,7)} by ${commit.author}: ${commit.message}`"
            >
              <span class="commit-sha">{{ commit.sha.slice(0, 7) }}</span>
              <span class="commit-msg">{{ commit.message }}</span>
              <span class="commit-author">{{ commit.author }}</span>
            </a>
          </div>
          <div v-else class="empty-text">
            <i class="pi pi-code" aria-hidden="true" style="font-size:1.2rem; opacity:0.4;" />
            <span>No commits cached for this sprint.</span>
          </div>
        </template>
        <div v-else class="empty-text">
          <i class="pi pi-github" aria-hidden="true" style="font-size:1.2rem; opacity:0.4;" />
          <span>No GitHub data cached. Refresh from the project dashboard.</span>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.review-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 960px;
  margin: 0 auto;
}

@media (max-width: 600px) {
  .review-page { padding: 1rem 0.75rem; }
  .page-title { font-size: 1.1rem; }
  .sprint-name { font-size: 1rem; }
  .hero-top { flex-direction: column; gap: 0.6rem; }
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.back-btn { flex-shrink: 0; margin-top: 0.25rem; }

.header-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.8);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon { color: var(--su-purple-400); }

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ── Cards ─────────────────────────────────────────────────────────────────── */

.hero-card,
.section-card,
.metric-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  padding: 1.1rem 1.25rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.1);
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-info { flex: 1; min-width: 0; }

.sprint-name {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--su-text);
  line-height: 1.2;
}

.sprint-dates {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--su-text-muted);
  margin-top: 0.25rem;
}

.sprint-goal {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--su-border);
}

.goal-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-purple-300);
}

.goal-text {
  font-size: 0.9rem;
  color: var(--su-text);
  line-height: 1.6;
}

/* ── Metrics grid ──────────────────────────────────────────────────────────── */

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 700px) {
  .metrics-grid { grid-template-columns: 1fr; }
}

.metric-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-purple-300);
  margin-bottom: 0.75rem;
}

.metric-sub {
  text-align: center;
  font-size: 0.78rem;
  color: var(--su-text-muted);
  margin-top: 0.35rem;
}

.velocity-compare {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 0.5rem;
}

.vel-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.vel-num {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--su-purple-300);
  line-height: 1;
}

.vel-sub {
  font-size: 0.68rem;
  color: var(--su-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.vel-divider {
  width: 1px;
  height: 2.5rem;
  background: var(--su-border);
}

/* ── Section ───────────────────────────────────────────────────────────────── */

.section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-purple-300);
  margin-bottom: 0.85rem;
}

/* ── GitHub highlights ─────────────────────────────────────────────────────── */

.gh-stats {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
}

.gh-stat-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  color: var(--su-text-muted);
}

.gh-stat-num {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--su-purple-300);
}

.gh-stat-lbl {
  font-size: 0.78rem;
  color: var(--su-text-muted);
}

.commits-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-text-muted);
  margin-bottom: 0.4rem;
}

.commits-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.commit-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  font-size: 0.8rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.15s;
}
.commit-row:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 6px 1px rgba(124, 58, 237, 0.2);
}
.commit-row:focus-visible {
  outline: 2px solid var(--su-border-glow);
  outline-offset: 2px;
}

@media (max-width: 500px) {
  .commit-row { flex-wrap: wrap; }
  .commit-author { width: 100%; }
}

.commit-sha {
  font-family: monospace;
  font-size: 0.72rem;
  background: rgba(124, 58, 237, 0.15);
  color: var(--su-purple-300);
  border-radius: 3px;
  padding: 0 0.3rem;
  flex-shrink: 0;
}

.commit-msg {
  flex: 1;
  color: var(--su-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commit-author {
  color: var(--su-text-muted);
  font-size: 0.72rem;
  flex-shrink: 0;
}

/* ── Shared ────────────────────────────────────────────────────────────────── */

.centered {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.centered-sm {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.mb-4 { margin-bottom: 1rem; }

.empty-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  color: var(--su-text-muted);
  font-size: 0.82rem;
  text-align: center;
  padding: 1.25rem 0;
}

/* ── Print styles ──────────────────────────────────────────────────────────── */

@media print {
  .no-print { display: none !important; }

  .review-page {
    background: #fff;
    color: #111;
    padding: 0;
    gap: 0.75rem;
  }

  .hero-card,
  .section-card,
  .metric-card {
    border: 1px solid #ccc;
    box-shadow: none;
    background: #fff;
    break-inside: avoid;
  }

  .page-title,
  .sprint-name,
  .vel-num,
  .gh-stat-num,
  .goal-label,
  .metric-label,
  .section-title {
    color: #4c1d95 !important;
    text-shadow: none !important;
  }

  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
