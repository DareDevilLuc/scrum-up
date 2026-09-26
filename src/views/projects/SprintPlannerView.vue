<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { supabase } from '@/lib/supabase'
import { useProjectsStore } from '@/stores/projects'
import { useSprintPlanner } from '@/composables/useSprintPlanner'
import type { TeamMemberInput } from '@/composables/useSprintPlanner'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const projectsStore = useProjectsStore()
const { plan, generating, confirming, error, generatePlan, confirmPlan } = useSprintPlanner()

const projectId = route.params.id as string

// ── Team members loaded from DB ───────────────────────────────────────────────
const teamMembers = ref<TeamMemberInput[]>([])
const loadingTeam = ref(false)

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
]

const assigneeOptions = computed(() => [
  { label: '— Unassigned —', value: null },
  ...teamMembers.value.map((m) => ({ label: m.display_name, value: m.user_id })),
])

// ── Load project + team on mount ──────────────────────────────────────────────
onMounted(async () => {
  await projectsStore.fetchProjectDetail(projectId)

  const project = projectsStore.currentProject
  if (!project?.team_id) return

  loadingTeam.value = true
  try {
    // 1. Fetch team members + their display names
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id, users(display_name)')
      .eq('team_id', project.team_id)

    if (membersError) throw membersError

    const userIds = (members ?? []).map((m: any) => m.user_id)

    // 2. Fetch developer profiles for those users (may not exist for all)
    const { data: profiles } = userIds.length
      ? await supabase
          .from('developer_profiles')
          .select('id, tech_stack, languages, experience_years')
          .in('id', userIds)
      : { data: [] }

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, p])
    )

    teamMembers.value = (members ?? []).map((m: any) => {
      const profile = profileMap[m.user_id]
      return {
        user_id: m.user_id,
        display_name: m.users?.display_name ?? 'Unknown',
        tech_stack: profile?.tech_stack ?? [],
        languages: profile?.languages ?? {},
        experience_years: profile?.experience_years ?? null,
      }
    })
  } finally {
    loadingTeam.value = false
  }
})

// ── Generate ──────────────────────────────────────────────────────────────────
async function handleGenerate() {
  const project = projectsStore.currentProject
  if (!project) return

  const ok = await generatePlan({
    project_id: projectId,
    requirements: project.requirements ?? '',
    start_date: project.start_date ?? '',
    end_date: project.end_date ?? '',
    team_members: teamMembers.value,
  })

  if (!ok) {
    toast.add({ severity: 'error', summary: 'Generation failed', detail: error.value ?? 'Unknown error', life: 5000 })
  }
}

// ── Add / Remove task helpers ─────────────────────────────────────────────────
function addTask(sprintIndex: number) {
  plan.value!.sprints[sprintIndex].tasks.push({
    title: '',
    description: '',
    priority: 'medium',
    story_points: 3,
    suggested_assignee_user_id: null,
  })
}

function removeTask(sprintIndex: number, taskIndex: number) {
  plan.value!.sprints[sprintIndex].tasks.splice(taskIndex, 1)
}

// ── Confirm plan ──────────────────────────────────────────────────────────────
const showSuccessDialog = ref(false)
const confirmedSprintCount = ref(0)
const confirmedTaskCount = ref(0)

async function handleConfirm() {
  // Capture counts before confirm clears plan
  const sprintCount = plan.value?.sprints.length ?? 0
  const taskCount = plan.value?.sprints.reduce((sum, s) => sum + s.tasks.length, 0) ?? 0

  const ok = await confirmPlan(projectId)
  if (ok) {
    confirmedSprintCount.value = sprintCount
    confirmedTaskCount.value = taskCount
    showSuccessDialog.value = true
  } else {
    toast.add({ severity: 'error', summary: 'Save failed', detail: error.value ?? 'Unknown error', life: 5000 })
  }
}

function goToDashboard() {
  showSuccessDialog.value = false
  router.push({ name: 'project-detail', params: { id: projectId } })
}

// ── Priority colour helper ────────────────────────────────────────────────────
function priorityClass(p: string) {
  return {
    low: 'badge-low',
    medium: 'badge-medium',
    high: 'badge-high',
    critical: 'badge-critical',
  }[p] ?? 'badge-medium'
}
</script>

<template>
  <div class="planner-view">
    <!-- Header -->
    <div class="page-header">
      <Button
        icon="pi pi-arrow-left"
        text
        @click="router.push({ name: 'project-detail', params: { id: projectId } })"
        class="back-btn"
      />
      <div>
        <h1 class="page-title">AI Sprint Planner</h1>
        <p class="page-subtitle">
          {{ projectsStore.currentProject?.name ?? '…' }} &mdash; generate and review an AI-crafted sprint plan
        </p>
      </div>
    </div>

    <!-- Loading project -->
    <div v-if="projectsStore.loading || loadingTeam" class="centered">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Error loading project -->
      <Message v-if="projectsStore.error" severity="error" :closable="false" class="mb-4">
        {{ projectsStore.error }}
      </Message>

      <!-- Generate button + team summary -->
      <div v-if="!plan" class="generate-panel">
        <div class="team-info">
          <span class="info-label">Team members loaded:</span>
          <span class="info-value">{{ teamMembers.length }}</span>
        </div>
        <div class="team-chips">
          <span v-for="m in teamMembers" :key="m.user_id" class="team-chip">
            {{ m.display_name }}
          </span>
          <span v-if="teamMembers.length === 0" class="no-team">
            No team members found. Assign a team to this project first.
          </span>
        </div>

        <Message v-if="error" severity="error" :closable="false" class="mb-4">{{ error }}</Message>

        <Button
          label="Generate Sprint Plan"
          icon="pi pi-bolt"
          :loading="generating"
          :disabled="!projectsStore.currentProject || teamMembers.length === 0"
          @click="handleGenerate"
          class="generate-btn"
        />
        <p class="generate-hint">
          The AI will analyse project requirements and team profiles to suggest sprints, tasks, priorities, and assignees.
        </p>
      </div>

      <!-- Editable plan -->
      <div v-if="plan" class="plan-container">
        <div class="plan-toolbar">
          <span class="plan-title">Review &amp; Edit Plan</span>
          <Button
            label="Regenerate"
            icon="pi pi-refresh"
            text
            :loading="generating"
            @click="handleGenerate"
          />
        </div>

        <Message v-if="error" severity="error" :closable="false" class="mb-4">{{ error }}</Message>

        <!-- Sprint cards -->
        <div
          v-for="(sprint, si) in plan.sprints"
          :key="si"
          class="sprint-card"
        >
          <!-- Sprint header -->
          <div class="sprint-header">
            <div class="sprint-meta">
              <span class="sprint-number">Sprint {{ si + 1 }}</span>
              <div class="sprint-dates">
                <InputText v-model="sprint.start_date" type="date" class="date-input" />
                <span class="date-sep">→</span>
                <InputText v-model="sprint.end_date" type="date" class="date-input" />
              </div>
            </div>
            <InputText
              v-model="sprint.name"
              placeholder="Sprint name"
              class="sprint-name-input"
            />
          </div>

          <div class="sprint-goal-row">
            <label class="field-label">Goal</label>
            <InputText v-model="sprint.goal" placeholder="Sprint goal…" class="w-full" />
          </div>

          <!-- Tasks table -->
          <div class="tasks-section">
            <div class="tasks-header">
              <span class="tasks-label">Tasks ({{ sprint.tasks.length }})</span>
            </div>

            <div class="task-row task-row-head">
              <span class="col-title">Title</span>
              <span class="col-desc">Description</span>
              <span class="col-priority">Priority</span>
              <span class="col-pts">Points</span>
              <span class="col-assignee">Assignee</span>
              <span class="col-remove"></span>
            </div>

            <div
              v-for="(task, ti) in sprint.tasks"
              :key="ti"
              class="task-row"
            >
              <InputText
                v-model="task.title"
                placeholder="Task title"
                class="col-title"
              />
              <InputText
                v-model="task.description"
                placeholder="Short description"
                class="col-desc"
              />
              <Dropdown
                v-model="task.priority"
                :options="priorityOptions"
                optionLabel="label"
                optionValue="value"
                class="col-priority"
              >
                <template #value="slotProps">
                  <span :class="['priority-badge', priorityClass(slotProps.value)]">
                    {{ slotProps.value }}
                  </span>
                </template>
              </Dropdown>
              <InputNumber
                v-model="task.story_points"
                :min="1"
                :max="13"
                inputClass="pts-input"
                class="col-pts"
                showButtons
                buttonLayout="horizontal"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
              />
              <Dropdown
                v-model="task.suggested_assignee_user_id"
                :options="assigneeOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Unassigned"
                class="col-assignee"
              />
              <Button
                icon="pi pi-trash"
                text
                severity="danger"
                class="col-remove"
                @click="removeTask(si, ti)"
              />
            </div>

            <!-- Add task -->
            <Button
              label="Add Task"
              icon="pi pi-plus"
              text
              class="add-task-btn"
              @click="addTask(si)"
            />
          </div>
        </div>

        <!-- Confirm -->
        <div class="confirm-bar">
          <Button
            label="Cancel"
            text
            @click="router.push({ name: 'project-detail', params: { id: projectId } })"
            :disabled="confirming"
          />
          <Button
            label="Confirm Plan"
            icon="pi pi-check"
            :loading="confirming"
            @click="handleConfirm"
          />
        </div>
      </div>
    </template>

  </div>

  <!-- ── Success Dialog ── -->
  <Dialog
    v-model:visible="showSuccessDialog"
    :closable="false"
    :modal="true"
    :draggable="false"
    class="success-dialog"
    :style="{ width: '26rem' }"
  >
    <template #header>
      <div class="success-header">
        <i class="pi pi-check-circle success-icon" />
        <span class="success-title">Plan Confirmed!</span>
      </div>
    </template>

    <div class="success-body">
      <p class="success-msg">Your sprint plan has been saved to the project.</p>
      <div class="success-stats">
        <div class="stat-chip">
          <i class="pi pi-calendar" />
          <span>{{ confirmedSprintCount }} sprint{{ confirmedSprintCount !== 1 ? 's' : '' }}</span>
        </div>
        <div class="stat-chip">
          <i class="pi pi-check-square" />
          <span>{{ confirmedTaskCount }} task{{ confirmedTaskCount !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        label="Go to Project Dashboard"
        icon="pi pi-arrow-right"
        icon-pos="right"
        class="w-full"
        @click="goToDashboard"
      />
    </template>
  </Dialog>

</template>

<style scoped>
.planner-view {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
  max-width: 1100px;
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
.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
}
.page-subtitle { margin: 0; color: var(--su-text-muted); font-size: 0.9rem; }

/* ── Centred spinner ── */
.centered { display: flex; justify-content: center; padding: 4rem 0; }
.mb-4 { margin-bottom: 1rem; }

/* ── Generate panel ── */
.generate-panel {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 0 12px 2px rgba(124, 58, 237, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 640px;
}
.team-info { display: flex; align-items: center; gap: 0.5rem; }
.info-label { font-size: 0.85rem; color: var(--su-text-muted); }
.info-value { font-size: 0.85rem; color: var(--su-purple-300); font-weight: 700; }
.team-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.team-chip {
  background: rgba(124, 58, 237, 0.15);
  border: 1px solid rgba(124, 58, 237, 0.35);
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  font-size: 0.78rem;
  color: var(--su-purple-300);
}
.no-team { font-size: 0.82rem; color: var(--su-text-muted); }
.generate-btn { align-self: flex-start; }
.generate-hint { margin: 0; font-size: 0.8rem; color: var(--su-text-muted); line-height: 1.5; }

/* ── Plan container ── */
.plan-container { display: flex; flex-direction: column; gap: 1.5rem; }
.plan-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.plan-title { font-size: 1rem; font-weight: 700; color: var(--su-purple-300); }

/* ── Sprint card ── */
.sprint-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 0 12px 2px rgba(124, 58, 237, 0.08);
}

.sprint-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.sprint-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.sprint-number {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--su-purple-400);
  background: rgba(124, 58, 237, 0.15);
  border: 1px solid rgba(124, 58, 237, 0.35);
  border-radius: 6px;
  padding: 0.15rem 0.55rem;
}
.sprint-dates { display: flex; align-items: center; gap: 0.4rem; }
.date-input { width: 150px; font-size: 0.82rem; }
.date-sep { color: var(--su-text-muted); font-size: 0.9rem; }
.sprint-name-input { font-size: 1rem; font-weight: 600; width: 100%; }

.sprint-goal-row { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.25rem; }
.field-label { font-size: 0.8rem; font-weight: 600; color: var(--su-text-muted); }
.w-full { width: 100%; }

/* ── Tasks ── */
.tasks-section { display: flex; flex-direction: column; gap: 0; }
.tasks-header { margin-bottom: 0.5rem; }
.tasks-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--su-text-muted); }

.task-row {
  display: grid;
  grid-template-columns: 2fr 2.5fr 110px 90px 1.5fr 36px;
  gap: 0.5rem;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--su-border);
}
.task-row:last-of-type { border-bottom: none; }
.task-row-head {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--su-text-muted);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--su-border-glow);
}
.col-title, .col-desc, .col-priority, .col-pts, .col-assignee, .col-remove {
  min-width: 0;
}

/* ── Priority badge ── */
.priority-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}
.badge-low    { background: rgba(34,197,94,0.12); color: var(--su-success); border: 1px solid rgba(34,197,94,0.35); }
.badge-medium { background: rgba(245,158,11,0.12); color: var(--su-warning); border: 1px solid rgba(245,158,11,0.35); }
.badge-high   { background: rgba(239,68,68,0.12); color: var(--su-danger); border: 1px solid rgba(239,68,68,0.35); }
.badge-critical { background: rgba(239,68,68,0.2); color: var(--su-danger); border: 1px solid var(--su-danger); }

/* ── Points input ── */
:deep(.pts-input) {
  width: 48px !important;
  text-align: center;
  font-size: 0.85rem;
}

/* ── Add task ── */
.add-task-btn { margin-top: 0.5rem; align-self: flex-start; }

/* ── Confirm bar ── */
.confirm-bar {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

/* ── Dropdown width ── */
:deep(.p-dropdown) { width: 100%; }

/* ── Success dialog ── */
.success-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.success-icon {
  font-size: 1.5rem;
  color: var(--su-success, #22c55e);
}
.success-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--su-text);
}
.success-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.25rem 0 0.5rem;
}
.success-msg {
  margin: 0;
  color: var(--su-text-muted);
  font-size: 0.9rem;
  line-height: 1.6;
}
.success-stats {
  display: flex;
  gap: 0.75rem;
}
.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.3);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--su-purple-300);
}
.stat-chip i { font-size: 0.8rem; }
</style>
