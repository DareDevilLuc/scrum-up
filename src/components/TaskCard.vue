<script setup lang="ts">
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import type { Task, TaskPriority } from '@/stores/kanban'

defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  (e: 'open', task: Task): void
}>()

function prioritySeverity(p: TaskPriority): string {
  switch (p) {
    case 'critical': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'info'
    default: return 'secondary'
  }
}

function priorityLabel(p: TaskPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
</script>

<template>
  <div class="task-card" @click="emit('open', task)">
    <div class="card-top">
      <span class="card-title">{{ task.title }}</span>
      <Tag
        :value="priorityLabel(task.priority)"
        :severity="prioritySeverity(task.priority)"
        class="priority-tag"
      />
    </div>

    <div class="card-bottom">
      <div class="assignees">
        <template v-if="task.assignees.length > 0">
          <Avatar
            v-for="a in task.assignees.slice(0, 3)"
            :key="a.user_id"
            :label="initials(a.display_name)"
            :image="a.avatar_url ?? undefined"
            shape="circle"
            size="small"
            class="assignee-avatar"
          />
          <span v-if="task.assignees.length > 3" class="extra-assignees">
            +{{ task.assignees.length - 3 }}
          </span>
        </template>
        <span v-else class="unassigned">Unassigned</span>
      </div>

      <div v-if="task.story_points !== null" class="points-chip">
        {{ task.story_points }} <span class="points-label">pts</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 8px 1px rgba(124, 58, 237, 0.1);
}

.task-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 14px 3px rgba(124, 58, 237, 0.3);
}

.card-top {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.card-title {
  flex: 1;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--su-text);
  line-height: 1.4;
  word-break: break-word;
}

.priority-tag {
  flex-shrink: 0;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.assignees {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-wrap: wrap;
}

:deep(.assignee-avatar .p-avatar) {
  background: var(--su-purple-700);
  color: var(--su-purple-200);
  font-size: 0.6rem;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--su-border-glow);
}

.extra-assignees {
  font-size: 0.72rem;
  color: var(--su-text-muted);
}

.unassigned {
  font-size: 0.72rem;
  color: var(--su-text-muted);
  font-style: italic;
}

.points-chip {
  background: rgba(124, 58, 237, 0.18);
  border: 1px solid rgba(124, 58, 237, 0.35);
  color: var(--su-purple-300);
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.55rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.points-label {
  font-weight: 400;
  opacity: 0.8;
}
</style>
