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

// Each column exposes the store's filtered arrays directly.
// vuedraggable mutates them during drag; we persist via @change (added event)
// which fires only on the destination column with the dropped element.
const todoList = computed(() => kanban.todoTasks)
const inProgressList = computed(() => kanban.inProgressTasks)
const doneList = computed(() => kanban.doneTasks)

async function onDragChange(event: any, newStatus: TaskStatus) {
  // @change fires on the column the card was dropped INTO with { added: { element } }
  if (!event.added) return
  const task: Task = event.added.element
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
  // Load tasks for current sprint — set selectedSprintId AFTER fetchTasks so the
  // watcher below doesn't also trigger a fetch for the initial value.
  await kanban.fetchTasks(sprintId.value)
  selectedSprintId.value = sprintId.value

  // Load dashboard for team members (needed for the assignee picker)
  if (dashboard.project?.id !== projectId.value) {
    await dashboard.fetchProjectOverview(projectId.value)
  }
})

// When sprint selector changes, navigate to the new sprint URL and load tasks.
// The route param sprintId is still the OLD value at this point, so the guard
// `newId !== sprintId.value` correctly prevents firing on the initial assignment.
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
          <i class="pi pi-table title-icon" aria-hidden="true" />
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
            aria-label="Select sprint"
          />

          <!-- Review / Retro links -->
          <Button
            label="Review"
            icon="pi pi-chart-bar"
            text
            aria-label="Go to sprint review"
            @click="router.push({ name: 'sprint-review', params: { id: projectId, sprintId } })"
          />
          <Button
            label="Retro"
            icon="pi pi-comments"
            text
            aria-label="Go to sprint retrospective"
            @click="router.push({ name: 'sprint-retro', params: { id: projectId, sprintId } })"
          />

          <!-- Add task button (project head only) -->
          <Button
            v-if="isProjectHead"
            label="Add Task"
            icon="pi pi-plus"
            aria-label="Add new task"
            @click="openCreateTask"
          />
        </div>
      </div>
    </div>

    <!-- Loading / error states -->
    <div v-if="kanban.loading" class="centered" role="status" aria-label="Loading tasks">
      <ProgressSpinner />
    </div>

    <Message v-else-if="kanban.error" severity="error" :closable="false" class="mb-4">
      {{ kanban.error }}
    </Message>

    <!-- Kanban columns -->
    <div v-else class="kanban-board" role="region" aria-label="Kanban board">
      <!-- TO DO -->
      <div class="kanban-column" role="group" aria-label="To Do column">
        <div class="column-header">
          <span class="column-title">To Do</span>
          <span class="column-count" aria-label="{{ todoList.length }} tasks">{{ todoList.length }}</span>
        </div>
        <draggable
          :list="todoList"
          group="tasks"
          item-key="id"
          class="column-cards"
          ghost-class="card-ghost"
          @change="(e) => onDragChange(e, 'todo')"
        >
          <template #item="{ element }">
            <TaskCard :task="element" @open="openTask" />
          </template>
          <template #footer>
            <div v-if="todoList.length === 0" class="empty-col" aria-label="No tasks in To Do">
              <i class="pi pi-inbox empty-col-icon" aria-hidden="true" />
              <span>No tasks here</span>
              <span class="empty-col-hint">Drag a task here</span>
            </div>
          </template>
        </draggable>
      </div>

      <!-- IN PROGRESS -->
      <div class="kanban-column" role="group" aria-label="In Progress column">
        <div class="column-header column-header--active">
          <span class="column-title">In Progress</span>
          <span class="column-count" aria-label="{{ inProgressList.length }} tasks">{{ inProgressList.length }}</span>
        </div>
        <draggable
          :list="inProgressList"
          group="tasks"
          item-key="id"
          class="column-cards"
          ghost-class="card-ghost"
          @change="(e) => onDragChange(e, 'in_progress')"
        >
          <template #item="{ element }">
            <TaskCard :task="element" @open="openTask" />
          </template>
          <template #footer>
            <div v-if="inProgressList.length === 0" class="empty-col" aria-label="No tasks in progress">
              <i class="pi pi-inbox empty-col-icon" aria-hidden="true" />
              <span>No tasks here</span>
              <span class="empty-col-hint">Drag a task here</span>
            </div>
          </template>
        </draggable>
      </div>

      <!-- DONE -->
      <div class="kanban-column" role="group" aria-label="Done column">
        <div class="column-header column-header--done">
          <span class="column-title">Done</span>
          <span class="column-count" aria-label="{{ doneList.length }} tasks">{{ doneList.length }}</span>
        </div>
        <draggable
          :list="doneList"
          group="tasks"
          item-key="id"
          class="column-cards"
          ghost-class="card-ghost"
          @change="(e) => onDragChange(e, 'done')"
        >
          <template #item="{ element }">
            <TaskCard :task="element" @open="openTask" />
          </template>
          <template #footer>
            <div v-if="doneList.length === 0" class="empty-col" aria-label="No completed tasks">
              <i class="pi pi-inbox empty-col-icon" aria-hidden="true" />
              <span>No tasks here</span>
              <span class="empty-col-hint">Drag a task here</span>
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

/* ── Page header ── */
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

/* Sprint selector focus/hover — supplement global theme overrides */
:deep(.sprint-select .p-select),
:deep(.sprint-select.p-select) {
  background: var(--su-bg-surface);
  border-color: var(--su-border);
  color: var(--su-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}

:deep(.sprint-select .p-select:not(.p-disabled).p-focus),
:deep(.sprint-select.p-select:not(.p-disabled).p-focus) {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
  outline: none;
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

/* Tablet: side-by-side pairs, then stack */
@media (max-width: 1024px) and (min-width: 601px) {
  .kanban-board {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .kanban-page {
    padding: 1rem 0.75rem;
  }

  .kanban-board {
    grid-template-columns: 1fr;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
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
  transition: box-shadow 0.2s;
}

/* Lift column on hover to signal it's a drop target */
.kanban-column:focus-within {
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 16px 4px rgba(124, 58, 237, 0.25);
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

/* ── Empty column state ── */
.empty-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 2rem 0 1.5rem;
  color: var(--su-text-muted);
  font-size: 0.8rem;
  pointer-events: none;
}

.empty-col-icon {
  font-size: 1.6rem;
  opacity: 0.35;
  color: var(--su-purple-400);
}

.empty-col-hint {
  font-size: 0.72rem;
  color: var(--su-border-glow);
  opacity: 0.6;
  border: 1px dashed var(--su-border-glow);
  border-radius: 4px;
  padding: 0.15rem 0.55rem;
  margin-top: 0.1rem;
}
</style>
