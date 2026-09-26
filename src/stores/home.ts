import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface MyTask {
  id: string
  title: string
  priority: TaskPriority
  status: TaskStatus
  story_points: number | null
  sprint_id: string
  sprint_name: string
  project_id: string
  project_name: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useHomeStore = defineStore('home', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const myTasks = ref<MyTask[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetch tasks assigned to the current user in active sprints.
   */
  async function fetchMyTasks(userId: string) {
    loading.value = true
    error.value = null
    try {
      // task_assignments → tasks → sprints (active only) → projects
      const { data, error: sbError } = await supabase
        .from('task_assignments')
        .select(`
          task_id,
          tasks (
            id,
            title,
            priority,
            status,
            story_points,
            sprint_id,
            sprints (
              id,
              name,
              status,
              project_id,
              projects ( id, name )
            )
          )
        `)
        .eq('user_id', userId)

      if (sbError) throw sbError

      const rows = (data ?? [])
        .map((a: any) => a.tasks)
        .filter(Boolean)
        // Only tasks in active sprints
        .filter((t: any) => t.sprints?.status === 'active')

      myTasks.value = rows.map((t: any) => ({
        id: t.id,
        title: t.title,
        priority: t.priority as TaskPriority,
        status: t.status as TaskStatus,
        story_points: t.story_points,
        sprint_id: t.sprint_id,
        sprint_name: t.sprints?.name ?? '—',
        project_id: t.sprints?.projects?.id ?? '',
        project_name: t.sprints?.projects?.name ?? '—',
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  function $reset() {
    myTasks.value = []
    loading.value = false
    error.value = null
  }

  return { myTasks, loading, error, fetchMyTasks, $reset }
})
