import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface TaskAssignee {
  user_id: string
  display_name: string
  avatar_url: string | null
}

export interface Task {
  id: string
  sprint_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  story_points: number | null
  assignees: TaskAssignee[]
}

export interface KanbanSprint {
  id: string
  name: string
  status: string
  order: number
}

export interface TaskFormData {
  title: string
  description: string | null
  priority: TaskPriority
  story_points: number | null
  assignee_ids: string[]
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useKanbanStore = defineStore('kanban', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const tasks = ref<Task[]>([])
  const sprints = ref<KanbanSprint[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const currentSprintId = ref<string | null>(null)
  const currentProjectId = ref<string | null>(null)

  // ── Getters ────────────────────────────────────────────────────────────────
  const todoTasks = computed(() => tasks.value.filter((t) => t.status === 'todo'))
  const inProgressTasks = computed(() => tasks.value.filter((t) => t.status === 'in_progress'))
  const doneTasks = computed(() => tasks.value.filter((t) => t.status === 'done'))

  // ── Actions ────────────────────────────────────────────────────────────────

  async function fetchSprints(projectId: string) {
    const { data, error: err } = await supabase
      .from('sprints')
      .select('id, name, status, order')
      .eq('project_id', projectId)
      .order('order', { ascending: true })

    if (err) throw err
    sprints.value = (data ?? []) as KanbanSprint[]
    currentProjectId.value = projectId
  }

  async function fetchTasks(sprintId: string) {
    loading.value = true
    error.value = null
    try {
      const { data: taskRows, error: taskErr } = await supabase
        .from('tasks')
        .select('id, sprint_id, title, description, status, priority, story_points')
        .eq('sprint_id', sprintId)
        .order('created_at', { ascending: true })

      if (taskErr) throw taskErr

      const rows = taskRows ?? []

      // Fetch assignees for all tasks in one query
      const taskIds = rows.map((t) => t.id)
      let assigneeMap: Record<string, TaskAssignee[]> = {}

      if (taskIds.length > 0) {
        const { data: assignments } = await supabase
          .from('task_assignments')
          .select('task_id, user_id, users(display_name, avatar_url)')
          .in('task_id', taskIds)

        for (const a of assignments ?? []) {
          const entry: TaskAssignee = {
            user_id: (a as any).user_id,
            display_name: (a as any).users?.display_name ?? 'Unknown',
            avatar_url: (a as any).users?.avatar_url ?? null,
          }
          if (!assigneeMap[(a as any).task_id]) assigneeMap[(a as any).task_id] = []
          assigneeMap[(a as any).task_id].push(entry)
        }
      }

      tasks.value = rows.map((t) => ({
        ...(t as any),
        assignees: assigneeMap[t.id] ?? [],
      })) as Task[]

      currentSprintId.value = sprintId
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    const oldStatus = task.status
    // Optimistic update
    task.status = newStatus
    const { error: err } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
    if (err) {
      // Revert on failure
      task.status = oldStatus
      throw err
    }
  }

  async function saveTask(
    taskData: TaskFormData,
    sprintId: string,
    taskId?: string,
  ): Promise<string> {
    saving.value = true
    try {
      const payload = {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        story_points: taskData.story_points,
      }

      let id = taskId ?? ''

      if (taskId) {
        // Update existing
        const { error: err } = await supabase.from('tasks').update(payload).eq('id', taskId)
        if (err) throw err
        id = taskId
      } else {
        // Create new
        const { data, error: err } = await supabase
          .from('tasks')
          .insert({ ...payload, sprint_id: sprintId, status: 'todo' })
          .select('id')
          .single()
        if (err) throw err
        id = (data as any).id
      }

      // Upsert task_assignments: delete all existing then insert new ones
      await supabase.from('task_assignments').delete().eq('task_id', id)

      if (taskData.assignee_ids.length > 0) {
        const { error: assignErr } = await supabase.from('task_assignments').insert(
          taskData.assignee_ids.map((uid) => ({ task_id: id, user_id: uid })),
        )
        if (assignErr) throw assignErr
      }

      // Refresh tasks list
      if (currentSprintId.value) {
        await fetchTasks(currentSprintId.value)
      }

      return id
    } finally {
      saving.value = false
    }
  }

  async function deleteTask(taskId: string) {
    saving.value = true
    try {
      const { error: err } = await supabase.from('tasks').delete().eq('id', taskId)
      if (err) throw err
      tasks.value = tasks.value.filter((t) => t.id !== taskId)
    } finally {
      saving.value = false
    }
  }

  function $reset() {
    tasks.value = []
    sprints.value = []
    loading.value = false
    saving.value = false
    error.value = null
    currentSprintId.value = null
    currentProjectId.value = null
  }

  return {
    tasks,
    sprints,
    loading,
    saving,
    error,
    currentSprintId,
    currentProjectId,
    todoTasks,
    inProgressTasks,
    doneTasks,
    fetchSprints,
    fetchTasks,
    updateTaskStatus,
    saveTask,
    deleteTask,
    $reset,
  }
})
