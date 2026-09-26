<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import Button from 'primevue/button'
import Select from 'primevue/select'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useKanbanStore } from '@/stores/kanban'
import type { Task, TaskStatus } from '@/stores/kanban'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'
import TaskCard from '@/components/TaskCard.vue'
import TaskDetailDialog from '@/components/TaskDetailDialog.vue'

// ── Router / stores ───────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const kanban = useKanbanStore()
const dashboard = useDashboardStore()
const auth = useAuthStore()
const toast = useToast()

const projectId = computed(() => route.params.id as string)
const sprintId = computed(() => route.params.sprintId as string)

// ── Role helpers ──────────────────────────────────────────────────────────────

const isProjectHead = computed(
  () => auth.role === 'project_head' || auth.role === 'super_admin',
)

// ── Sprint selector ───────────────────────────────────────────────────────────

const selectedSprintId = ref<string | null>(null)
const sprintOptions = computed(() =>
  kanban.sprints.map((s) => ({ label: s.name, value: s.id })),
)

// ── Dialog state ──────────────────────────────────────────────────────────────

const dialogVisible = ref(false)
const activeTask = ref<Task | null>(null)

function openTask(task: Task) {
  activeTask.value = task
  dialogVisible.value = true
}

function openCreateTask() {
  activeTask.value = null
  dialogVisible.value = true
}

// ── Drag-and-drop ─────────────────────────────────────────────────────────────

// Each column manages its own list. We clone from the store so draggable can
// mutate locally, then we persist the status change to Supabase.
const todoList = computed({
  get: () => kanban.todoTasks,
  set: () => {},
})
const inProgressList = computed({
  get: () => kanban.inProgressTasks,
  set: () => {},
})
const doneList = computed({
  get: () => kanban.doneTasks,
  set: () => {},
})

async function onDragEnd(event: any, newStatus: TaskStatus) {
  const task: Task | undefined = event.item?.__draggable_context?.element
  if (!task) return
  if (task.status === newStatus) return

  // Authorisation: developers can only move their own tasks
  if (!isProjectHead.value) {
    const userId = auth.user?.id
    const isAssigned = task.assignees.some((a) => a.user_id === userId)
    if (!isAssigned) {
      toast.add({
        severity: 'warn',
        summary: 'Permission denied',
        detail: 'You can only move tasks assigned to you.',
        life: 4000,
      })
      // Force re-fetch to revert visual state
      await kanban.fetchTasks(sprintId.value)
      return
    }
  }

  try {
    await kanban.updateTaskStatus(task.id, newStatus)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: (e as Error).message, life: 5000 })
    await kanban.fetchTasks(sprintId.value)
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Load sprints if not already loaded for this project
  if (kanban.currentProjectId !== projectId.value) {
    await kanban.fetchSprints(projectId.value)
  }
  // Load tasks for current sprint
  selectedSprintId.value = sprintId.value
  await kanban.fetchTasks(sprintId.value)

  // Load dashboard for team members (needed for the assignee picker)
  if (dashboard.project?.id !== projectId.value) {
    await dashboard.fetchProjectOverview(projectId.value)
  }
})

// When sprint selector changes, navigate to the new sprint URL
watch(selectedSprintId, async (newId) => {
  if (newId && newId !== sprintId.value) {
    await router.push({ name: 'kanban', params: { id: projectId.value, sprintId: newId } })
    await kanban.fetchTasks(newId)
  }
})
</script>

<template>
  <Toast />

  <div class="kanban-page">
    <!-- Page header -->
    <div class="page-header">
      <Button
        icon="pi pi-arrow-left"
        text
        class="back-btn"
        @click="router.push({ name: 'project-detail', params: { id: projectId } })"
        aria-label="Back to project"
      />

      <div class="header-content">
        <h1 class="page-title">
          <i class="pi pi-table title-icon" />
          Kanban Board
        </h1>

        <div class="header-actions">
          <!-- Sprint selector -->
          <Select
            v-model="selectedSprintId"
            :options="sprintOptions"
            option-label="label"
            option-value="value"
            placeholder="Select sprint"
            class="sprint-select"
          />

          <!-- Add task button (project head only) -->
          <Button
            v-if="isProjectHead"
            label="Add Task"
            icon="pi pi-plus"
            @click="openCreateTask"
          />
        </div>
      </div>
    </div>

    <!-- Loading / error states -->
    <div v-if="kanban.loading" class="centered">
      <ProgressSpinner />
    </div>

    <Message v-else-if="kanban.error" severity="error" :closable="false" class="mb-4">
      {{ kanban.error }}
    </Message>

    <!-- Kanban columns -->
    <div v-else class="kanban-board">
      <!-- TO DO -->
      <div class="kanban-column">
        <div class="column-header">
          <span class="column-title">To Do</span>
          <span class="column-count">{{ todoList.length }}</span>
        </div>
        <draggable
          :list="kanban.tasks.filter(t => t.status === 'todo')"
          group="tasks"
          item-key="id"
          class="column-cards"
          ghost-class="card-ghost"
          @end="(e) => onDragEnd(e, 'todo')"
        >
          <template #item="{ element }">
            <TaskCard :task="element" @open="openTask" />
          </template>
          <template #footer>
            <div v-if="kanban.tasks.filter(t => t.status === 'todo').length === 0" class="empty-col">
              <i class="pi pi-inbox empty-col-icon" />
              <span>No tasks here</span>
            </div>
          </template>
        </draggable>
      </div>

      <!-- IN PROGRESS -->
      <div class="kanban-column">
        <div class="column-header column-header--active">
          <span class="column-title">In Progress</span>
          <span class="column-count">{{ inProgressList.length }}</span>
        </div>
        <draggable
          :list="kanban.tasks.filter(t => t.status === 'in_progress')"
          group="tasks"
          item-key="id"
          class="column-cards"
          ghost-class="card-ghost"
          @end="(e) => onDragEnd(e, 'in_progress')"
        >
          <template #item="{ element }">
            <TaskCard :task="element" @open="openTask" />
          </template>
          <template #footer>
            <div v-if="kanban.tasks.filter(t => t.status === 'in_progress').length === 0" class="empty-col">
              <i class="pi pi-inbox empty-col-icon" />
              <span>No tasks here</span>
            </div>
          </template>
        </draggable>
      </div>

      <!-- DONE -->
      <div class="kanban-column">
        <div class="column-header column-header--done">
          <span class="column-title">Done</span>
          <span class="column-count">{{ doneList.length }}</span>
        </div>
        <draggable
          :list="kanban.tasks.filter(t => t.status === 'done')"
          group="tasks"
          item-key="id"
          class="column-cards"
          ghost-class="card-ghost"
          @end="(e) => onDragEnd(e, 'done')"
        >
          <template #item="{ element }">
            <TaskCard :task="element" @open="openTask" />
          </template>
          <template #footer>
            <div v-if="kanban.tasks.filter(t => t.status === 'done').length === 0" class="empty-col">
              <i class="pi pi-inbox empty-col-icon" />
              <span>No tasks here</span>
            </div>
          </template>
        </draggable>
      </div>
    </div>
  </div>

  <!-- Task detail / create dialog -->
  <TaskDetailDialog
    v-model:visible="dialogVisible"
    :task="activeTask"
    :sprint-id="sprintId"
    :team-members="dashboard.teamMembers"
    :is-project-head="isProjectHead"
    @saved="kanban.fetchTasks(sprintId)"
    @deleted="kanban.fetchTasks(sprintId)"
  />
</template>

<style scoped>
.kanban-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.back-btn {
  flex-shrink: 0;
  margin-top: 0.25rem;
}

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

.title-icon {
  color: var(--su-purple-400);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sprint-select {
  min-width: 180px;
}

:deep(.sprint-select .p-select),
:deep(.sprint-select.p-select) {
  background: var(--su-bg-surface);
  border-color: var(--su-border);
  color: var(--su-text);
}

:deep(.sprint-select .p-select:not(.p-disabled).p-focus),
:deep(.sprint-select.p-select:not(.p-disabled).p-focus) {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

.centered {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.mb-4 {
  margin-bottom: 1rem;
}

/* ── Kanban Board ─────────────────────────────────────────────────────────── */

.kanban-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  align-items: flex-start;
  flex: 1;
}

@media (max-width: 900px) {
  .kanban-board {
    grid-template-columns: 1fr;
  }
}

.kanban-column {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.1);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--su-border);
  border-radius: 10px 10px 0 0;
}

.column-header--active {
  border-bottom-color: var(--su-warning);
  box-shadow: inset 0 -2px 0 0 var(--su-warning);
}

.column-header--done {
  border-bottom-color: var(--su-success);
  box-shadow: inset 0 -2px 0 0 var(--su-success);
}

.column-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-text-muted);
}

.column-count {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.55rem;
  min-width: 1.4rem;
  text-align: center;
}

.column-cards {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  flex: 1;
  min-height: 80px;
}

.card-ghost {
  opacity: 0.4;
  border: 2px dashed var(--su-border-glow);
  border-radius: 8px;
}

.empty-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.5rem 0;
  color: var(--su-text-muted);
  font-size: 0.8rem;
  pointer-events: none;
}

.empty-col-icon {
  font-size: 1.4rem;
  opacity: 0.45;
}
</style>
