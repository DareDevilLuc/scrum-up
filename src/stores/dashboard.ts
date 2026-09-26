import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import type { ProjectDetail } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'

// ── Local types ───────────────────────────────────────────────────────────────

export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string | null
  start_date: string | null
  end_date: string | null
  status: SprintStatus
  order: number
  ai_summary: string | null
  retrospective_notes: string | null
}

export interface TeamMember {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  github_username: string | null
}

export interface TaskCounts {
  todo: number
  in_progress: number
  done: number
  total: number
  total_points: number
  completed_points: number
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = defineStore('dashboard', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const project = ref<ProjectDetail | null>(null)
  const sprints = ref<Sprint[]>([])
  const currentSprint = ref<Sprint | null>(null)
  const teamMembers = ref<TeamMember[]>([])
  const githubRepoName = ref<string | null>(null)
  const githubRepoUrl = ref<string | null>(null)
  const taskCounts = ref<TaskCounts>({ todo: 0, in_progress: 0, done: 0, total: 0, total_points: 0, completed_points: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ────────────────────────────────────────────────────────────────

  const hasNoSprints = computed(() => !loading.value && sprints.value.length === 0)

  const isProjectHead = computed(() => {
    const auth = useAuthStore()
    return (
      auth.role === 'super_admin' ||
      (auth.role === 'project_head' && project.value?.created_by === auth.user?.id)
    )
  })

  const completionPercent = computed(() => {
    const total = taskCounts.value.total_points
    if (!total) return 0
    return Math.round((taskCounts.value.completed_points / total) * 100)
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Load the full project overview: project row, sprints, team members,
   * github repo, and task counts for the currently selected (or first active) sprint.
   */
  async function fetchProjectOverview(projectId: string) {
    loading.value = true
    error.value = null
    try {
      // 1 — Project detail
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name, requirements, status, start_date, end_date, created_at, client_id, team_id, created_by, clients(name), teams(name)')
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError

      project.value = {
        ...projectData,
        client_name: (projectData as any).clients?.name ?? null,
        team_name: (projectData as any).teams?.name ?? null,
      }

      // 2 — Sprints
      const { data: sprintsData, error: sprintsError } = await supabase
        .from('sprints')
        .select('id, project_id, name, goal, start_date, end_date, status, order, ai_summary, retrospective_notes')
        .eq('project_id', projectId)
        .order('order', { ascending: true })

      if (sprintsError) throw sprintsError
      const fetchedSprints: Sprint[] = sprintsData ?? []

      // Auto-activate any planned sprint whose start_date is today or in the past
      const today = new Date().toISOString().slice(0, 10)
      const toActivate = fetchedSprints.filter(
        (s) => s.status === 'planned' && s.start_date !== null && s.start_date <= today,
      )
      if (toActivate.length > 0) {
        await Promise.all(
          toActivate.map((s) =>
            supabase.from('sprints').update({ status: 'active' }).eq('id', s.id),
          ),
        )
        toActivate.forEach((s) => { s.status = 'active' })
      }

      sprints.value = fetchedSprints

      // Auto-select: prefer active sprint, else first planned, else first
      const active = sprints.value.find((s) => s.status === 'active')
      const planned = sprints.value.find((s) => s.status === 'planned')
      currentSprint.value = active ?? planned ?? sprints.value[0] ?? null

      // 3 — Team members (via team_id → team_members → users)
      if (project.value?.team_id) {
        const { data: membersData } = await supabase
          .from('team_members')
          .select('user_id, users(display_name, avatar_url, github_username)')
          .eq('team_id', project.value.team_id)

        teamMembers.value = (membersData ?? []).map((m: any) => ({
          user_id: m.user_id,
          display_name: m.users?.display_name ?? null,
          avatar_url: m.users?.avatar_url ?? null,
          github_username: m.users?.github_username ?? null,
        }))
      }

      // 4 — GitHub repo (if linked)
      const { data: repoData } = await supabase
        .from('github_repos')
        .select('repo_full_name, repo_url')
        .eq('project_id', projectId)
        .maybeSingle()

      githubRepoName.value = repoData?.repo_full_name ?? null
      githubRepoUrl.value = repoData?.repo_url ?? null

      // 5 — Task counts for current sprint
      if (currentSprint.value) {
        await _fetchTaskCounts(currentSprint.value.id)
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /**
   * Manually set a sprint's status.
   * Only project_head / super_admin should call this (enforced in the UI via isProjectHead).
   * Patches the database and updates local state immediately so the view reacts.
   */
  async function updateSprintStatus(sprintId: string, status: SprintStatus) {
    const { error: err } = await supabase
      .from('sprints')
      .update({ status })
      .eq('id', sprintId)
    if (err) throw err

    const sprint = sprints.value.find((s) => s.id === sprintId)
    if (sprint) sprint.status = status

    if (currentSprint.value?.id === sprintId) {
      currentSprint.value = { ...currentSprint.value, status }
    }
  }

  /** Switch the active sprint and reload task counts. */
  async function selectSprint(sprint: Sprint) {
    currentSprint.value = sprint
    await _fetchTaskCounts(sprint.id)
  }

  async function _fetchTaskCounts(sprintId: string) {
    const { data } = await supabase
      .from('tasks')
      .select('status, story_points')
      .eq('sprint_id', sprintId)

    const rows = data ?? []
    taskCounts.value = {
      todo: rows.filter((t: any) => t.status === 'todo').length,
      in_progress: rows.filter((t: any) => t.status === 'in_progress').length,
      done: rows.filter((t: any) => t.status === 'done').length,
      total: rows.length,
      total_points: rows.reduce((sum: number, t: any) => sum + (t.story_points ?? 0), 0),
      completed_points: rows
        .filter((t: any) => t.status === 'done')
        .reduce((sum: number, t: any) => sum + (t.story_points ?? 0), 0),
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function $reset() {
    project.value = null
    sprints.value = []
    currentSprint.value = null
    teamMembers.value = []
    githubRepoName.value = null
    githubRepoUrl.value = null
    taskCounts.value = { todo: 0, in_progress: 0, done: 0, total: 0, total_points: 0, completed_points: 0 }
    loading.value = false
    error.value = null
  }

  return {
    project,
    sprints,
    currentSprint,
    teamMembers,
    githubRepoName,
    githubRepoUrl,
    taskCounts,
    loading,
    error,
    hasNoSprints,
    isProjectHead,
    completionPercent,
    fetchProjectOverview,
    selectSprint,
    updateSprintStatus,
    $reset,
  }
})
