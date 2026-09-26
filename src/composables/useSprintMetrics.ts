import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SprintTask {
  id: string
  status: string
  story_points: number | null
  created_at: string
}

export interface BurndownPoint {
  date: string   // 'YYYY-MM-DD'
  remaining: number
}

export interface CompletionCounts {
  done: number
  in_progress: number
  todo: number
  total: number
  percent: number
}

export interface GitHubCommitDay {
  date: string   // 'YYYY-MM-DD'
  count: number
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useSprintMetrics(sprintIdRef: { value: string | null }) {
  const tasks = ref<SprintTask[]>([])
  const burndownSeries = ref<BurndownPoint[]>([])
  const completionCounts = ref<CompletionCounts>({ done: 0, in_progress: 0, todo: 0, total: 0, percent: 0 })
  const commitsByDay = ref<GitHubCommitDay[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Sprint-level metadata (needed for date range)
  const sprintStartDate = ref<string | null>(null)
  const sprintEndDate = ref<string | null>(null)

  async function fetchMetrics(sprintId: string) {
    if (!sprintId) return
    loading.value = true
    error.value = null
    try {
      // 1. Sprint date range + cached github data
      const { data: sprintRow, error: sprintErr } = await supabase
        .from('sprints')
        .select('start_date, end_date, github_sprint_data')
        .eq('id', sprintId)
        .single()

      if (sprintErr) throw sprintErr
      sprintStartDate.value = sprintRow.start_date
      sprintEndDate.value = sprintRow.end_date

      // 2. All tasks in sprint
      const { data: taskRows, error: taskErr } = await supabase
        .from('tasks')
        .select('id, status, story_points, created_at')
        .eq('sprint_id', sprintId)

      if (taskErr) throw taskErr
      tasks.value = (taskRows ?? []) as SprintTask[]

      // 3. Completion counts
      const done = tasks.value.filter((t) => t.status === 'done').length
      const inProgress = tasks.value.filter((t) => t.status === 'in_progress').length
      const todo = tasks.value.filter((t) => t.status === 'todo').length
      const total = tasks.value.length
      completionCounts.value = {
        done,
        in_progress: inProgress,
        todo,
        total,
        percent: total ? Math.round((done / total) * 100) : 0,
      }

      // 4. Burndown series
      burndownSeries.value = computeBurndown(tasks.value, sprintRow.start_date, sprintRow.end_date)

      // 5. GitHub commit frequency (from cached github_sprint_data)
      const ghData = sprintRow.github_sprint_data as { commits?: { date: string }[] } | null
      if (ghData?.commits?.length) {
        commitsByDay.value = aggregateCommitsByDay(ghData.commits)
      } else {
        commitsByDay.value = []
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  // ── Watch sprint ID and refetch ────────────────────────────────────────────
  watch(
    () => sprintIdRef.value,
    (id) => { if (id) fetchMetrics(id) },
    { immediate: true },
  )

  return {
    tasks,
    burndownSeries,
    completionCounts,
    commitsByDay,
    sprintStartDate,
    sprintEndDate,
    loading,
    error,
    fetchMetrics,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a burndown series: for each calendar day from start_date to today
 * (capped at end_date), compute remaining story points.
 * A task is "remaining" on a given day if its status is not 'done' OR
 * its updated_at (proxy for completion date) is after that day.
 */
function computeBurndown(
  tasks: SprintTask[],
  startDate: string | null,
  endDate: string | null,
): BurndownPoint[] {
  if (!startDate) return []

  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  const today = new Date()
  const rangeEnd = end < today ? end : today

  const days: BurndownPoint[] = []
  const cur = new Date(start)

  while (cur <= rangeEnd) {
    const dayStr = cur.toISOString().slice(0, 10)
    const dayEnd = new Date(cur)
    dayEnd.setHours(23, 59, 59, 999)

    const remaining = tasks.reduce((sum, t) => {
      const pts = t.story_points ?? 1
      if (t.status !== 'done') return sum + pts
      // Task is done — use created_at as completion date proxy
      const completedAt = new Date((t as any).created_at ?? dayStr)
      return completedAt <= dayEnd ? sum : sum + pts
    }, 0)

    days.push({ date: dayStr, remaining })
    cur.setDate(cur.getDate() + 1)
  }

  return days
}

/**
 * Aggregate an array of commit objects (each with a `date` ISO string)
 * into per-day counts.
 */
function aggregateCommitsByDay(commits: { date: string }[]): GitHubCommitDay[] {
  const map = new Map<string, number>()
  for (const c of commits) {
    const day = c.date?.slice(0, 10)
    if (day) map.set(day, (map.get(day) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))
}
