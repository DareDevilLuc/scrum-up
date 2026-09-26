import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import type { ProjectDetail } from '@/stores/projects'

// ── Local types ───────────────────────────────────────────────────────────────

export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  name: string
  goal: string | null
  status: SprintStatus
  start_date: string | null
  end_date: string | null
  order: number
  task_count: number
  completed_task_count: number
  completed_story_points: number
}

export interface TeamMemberStrip {
  user_id: string
  display_name: string
  avatar_url: string | null
}

export interface LinkedRepo {
  id: string
  repo_full_name: string
  repo_url: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = defineStore('dashboard', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const project = ref<ProjectDetail | null>(null)
  const sprints = ref<Sprint[]>([])
  const teamMembers = ref<TeamMemberStrip[]>([])
  const currentSprint = ref<Sprint | null>(null)
  const linkedRepo = ref<LinkedRepo | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ────────────────────────────────────────────────────────────────
  const activeSprint = computed(() =>
    sprints.value.find((s) => s.status === 'active') ?? null,
  )

  const currentTaskCount = computed(() => currentSprint.value?.task_count ?? 0)
  const currentCompletedCount = computed(() => currentSprint.value?.completed_task_count ?? 0)

  // ── Actions ────────────────────────────────────────────────────────────────

  async function fetchProjectOverview(projectId: string) {
    loading.value = true
    error.value = null
    try {
      // 1. Project detail
      const { data: proj, error: projError } = await supabase
        .from('projects')
        .select(`
          id, name, requirements, status, start_date, end_date, created_at,
          client_id, team_id, created_by,
          clients(name),
          teams(name)
        `)
        .eq('id', projectId)
        .single()

      if (projError) throw projError

      project.value = {
        ...(proj as any),
        client_name: (proj as any).clients?.name ?? null,
        team_name: (proj as any).teams?.name ?? null,
      }

      // 2. Sprints with task counts
      const { data: sprintRows, error: sprintError } = await supabase
        .from('sprints')
        .select('id, name, goal, status, start_date, end_date, order')
        .eq('project_id', projectId)
        .order('order', { ascending: true })

      if (sprintError) throw sprintError

      const enriched: Sprint[] = await Promise.all(
        (sprintRows ?? []).map(async (s) => {
          const { count: totalCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('sprint_id', s.id)

          const { data: doneTasks } = await supabase
            .from('tasks')
            .select('story_points')
            .eq('sprint_id', s.id)
            .eq('status', 'done')

          const doneCount = doneTasks?.length ?? 0
          const donePoints = (doneTasks ?? []).reduce(
            (sum: number, t: any) => sum + (t.story_points ?? 0),
            0,
          )

          return {
            ...s,
            task_count: totalCount ?? 0,
            completed_task_count: doneCount,
            completed_story_points: donePoints,
          } as Sprint
        }),
      )

      sprints.value = enriched
      // Default selection: active sprint, else first
      currentSprint.value = enriched.find((s) => s.status === 'active') ?? enriched[0] ?? null

      // 3. Linked GitHub repo
      const { data: repoRow } = await supabase
        .from('github_repos')
        .select('id, repo_full_name, repo_url')
        .eq('project_id', projectId)
        .maybeSingle()

      linkedRepo.value = repoRow
        ? { id: repoRow.id, repo_full_name: repoRow.repo_full_name, repo_url: repoRow.repo_url }
        : null

      // 4. Team members strip
      const teamId = project.value?.team_id
      if (teamId) {
        const { data: members } = await supabase
          .from('team_members')
          .select('user_id, users(display_name, avatar_url)')
          .eq('team_id', teamId)

        teamMembers.value = (members ?? []).map((m: any) => ({
          user_id: m.user_id,
          display_name: m.users?.display_name ?? 'Unknown',
          avatar_url: m.users?.avatar_url ?? null,
        }))
      } else {
        teamMembers.value = []
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  function selectSprint(sprint: Sprint) {
    currentSprint.value = sprint
  }

  function $reset() {
    project.value = null
    sprints.value = []
    teamMembers.value = []
    currentSprint.value = null
    linkedRepo.value = null
    loading.value = false
    error.value = null
  }

  return {
    project,
    sprints,
    teamMembers,
    currentSprint,
    linkedRepo,
    loading,
    error,
    activeSprint,
    currentTaskCount,
    currentCompletedCount,
    fetchProjectOverview,
    selectSprint,
    $reset,
  }
})
