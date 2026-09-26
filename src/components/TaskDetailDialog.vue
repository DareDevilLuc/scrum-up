<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useKanbanStore } from '@/stores/kanban'
import type { Task, TaskPriority, TaskFormData } from '@/stores/kanban'
import type { TeamMemberStrip } from '@/stores/dashboard'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean
  task: Task | null          // null = create mode
  sprintId: string
  teamMembers: TeamMemberStrip[]
  isProjectHead: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

// ── Store / toast ─────────────────────────────────────────────────────────────

const kanban = useKanbanStore()
const toast = useToast()

// ── Form state ────────────────────────────────────────────────────────────────

const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('medium')
const storyPoints = ref<number | null>(null)
const assigneeIds = ref<string[]>([])
const deleteConfirm = ref(false)

const isEdit = computed(() => !!props.task)
const dialogTitle = computed(() => (isEdit.value ? 'Edit Task' : 'New Task'))

const priorityOptions: { label: string; value: TaskPriority }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
]

const memberOptions = computed(() =>
  props.teamMembers.map((m) => ({ label: m.display_name, value: m.user_id })),
)

// ── Sync form when dialog opens or task changes ───────────────────────────────

watch(
  () => [props.visible, props.task] as const,
  ([vis]) => {
    if (!vis) {
      deleteConfirm.value = false
      return
    }
    if (props.task) {
      title.value = props.task.title
      description.value = props.task.description ?? ''
      priority.value = props.task.priority
      storyPoints.value = props.task.story_points ?? null
      assigneeIds.value = props.task.assignees.map((a) => a.user_id)
    } else {
      title.value = ''
      description.value = ''
      priority.value = 'medium'
      storyPoints.value = null
      assigneeIds.value = []
    }
    deleteConfirm.value = false
  },
  { immediate: true },
)

// ── Actions ───────────────────────────────────────────────────────────────────

async function save() {
  if (!title.value.trim()) return

  const payload: TaskFormData = {
    title: title.value.trim(),
    description: description.value.trim() || null,
    priority: priority.value,
    story_points: storyPoints.value,
    assignee_ids: assigneeIds.value,
  }

  try {
    await kanban.saveTask(payload, props.sprintId, props.task?.id)
    toast.add({ severity: 'success', summary: 'Saved', detail: 'Task saved successfully', life: 3000 })
    emit('saved')
    emit('update:visible', false)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: (e as Error).message, life: 5000 })
  }
}

async function confirmDelete() {
  if (!props.task) return
  try {
    await kanban.deleteTask(props.task.id)
    toast.add({ severity: 'success', summary: 'Deleted', detail: 'Task deleted', life: 3000 })
    emit('deleted')
    emit('update:visible', false)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: (e as Error).message, life: 5000 })
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    :header="dialogTitle"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="task-dialog"
    style="width: min(560px, 95vw)"
  >
    <div class="form-body">
      <!-- Title -->
      <div class="field">
        <label class="field-label">Title <span class="required">*</span></label>
        <InputText v-model="title" class="full-width" placeholder="Task title" />
      </div>

      <!-- Description -->
      <div class="field">
        <label class="field-label">Description</label>
        <Textarea v-model="description" class="full-width" rows="3" placeholder="Optional details…" auto-resize />
      </div>

      <!-- Priority + Story Points row -->
      <div class="field-row">
        <div class="field">
          <label class="field-label">Priority</label>
          <Select
            v-model="priority"
            :options="priorityOptions"
            option-label="label"
            option-value="value"
            class="full-width"
          />
        </div>
        <div class="field">
          <label class="field-label">Story Points</label>
          <InputNumber
            v-model="storyPoints"
            :min="0"
            :max="100"
            class="full-width"
            placeholder="0"
            :show-buttons="false"
          />
        </div>
      </div>

      <!-- Assignees -->
      <div class="field">
        <label class="field-label">Assignees</label>
        <MultiSelect
          v-model="assigneeIds"
          :options="memberOptions"
          option-label="label"
          option-value="value"
          placeholder="Select team members"
          display="chip"
          class="full-width"
        />
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="dialog-footer">
        <!-- Delete (project head + edit mode only) -->
        <div class="delete-area" v-if="isProjectHead && isEdit">
          <template v-if="!deleteConfirm">
            <Button
              label="Delete"
              severity="danger"
              text
              @click="deleteConfirm = true"
              :loading="kanban.saving"
            />
          </template>
          <template v-else>
            <span class="confirm-text">Are you sure?</span>
            <Button label="Yes, delete" severity="danger" size="small" @click="confirmDelete" :loading="kanban.saving" />
            <Button label="Cancel" text size="small" @click="deleteConfirm = false" />
          </template>
        </div>

        <div class="action-btns">
          <Button label="Cancel" text @click="emit('update:visible', false)" />
          <Button
            :label="isEdit ? 'Save Changes' : 'Create Task'"
            @click="save"
            :loading="kanban.saving"
            :disabled="!title.trim()"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
:deep(.task-dialog .p-dialog) {
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 24px 6px rgba(124, 58, 237, 0.25);
}

:deep(.task-dialog .p-dialog-header) {
  background: var(--su-bg-elevated);
  border-bottom: 1px solid var(--su-border);
  color: var(--su-purple-300);
}

:deep(.task-dialog .p-dialog-content) {
  background: var(--su-bg-elevated);
  padding: 1.25rem 1.5rem;
}

:deep(.task-dialog .p-dialog-footer) {
  background: var(--su-bg-elevated);
  border-top: 1px solid var(--su-border);
  padding: 0.75rem 1.5rem;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--su-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.required {
  color: var(--su-danger);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.full-width {
  width: 100%;
}

:deep(.p-inputtext),
:deep(.p-textarea),
:deep(.p-select),
:deep(.p-multiselect),
:deep(.p-inputnumber-input) {
  background: var(--su-bg-surface);
  border-color: var(--su-border);
  color: var(--su-text);
  width: 100%;
}

:deep(.p-inputtext:focus),
:deep(.p-textarea:focus),
:deep(.p-select.p-focus),
:deep(.p-multiselect.p-focus),
:deep(.p-inputnumber-input:focus) {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

:deep(.p-select-overlay),
:deep(.p-multiselect-overlay) {
  background: var(--su-bg-elevated);
  border-color: var(--su-border);
}

:deep(.p-select-option:hover),
:deep(.p-multiselect-option:hover) {
  background: rgba(124, 58, 237, 0.15);
}

:deep(.p-chip) {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.4);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.5rem;
}

.delete-area {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.confirm-text {
  font-size: 0.82rem;
  color: var(--su-danger);
}

.action-btns {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}
</style>
