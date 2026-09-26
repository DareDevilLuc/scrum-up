import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface PlanTask {
  title: string
  description: string
  priority: TaskPriority
  story_points: number
  suggested_assignee_user_id: string | null
}

export interface PlanSprint {
  name: string
  goal: string
  start_date: string
  end_date: string
  tasks: PlanTask[]
}

export interface SprintPlan {
  sprints: PlanSprint[]
}

export interface TeamMemberInput {
  user_id: string
  display_name: string
  tech_stack: string[]
  languages: Record<string, number>
  experience_years: number | null
}

export interface GenerateInput {
  project_id: string
  requirements: string
  start_date: string
  end_date: string
  team_members: TeamMemberInput[]
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useSprintPlanner() {
  const plan = ref<SprintPlan | null>(null)
  const generating = ref(false)
  const confirming = ref(false)
  const error = ref<string | null>(null)

  /**
   * Call the Edge Function to generate an AI sprint plan.
   * The result is stored in `plan` and is fully editable in-place.
   */
  async function generatePlan(input: GenerateInput): Promise<boolean> {
    generating.value = true
    error.value = null
    plan.value = null
    try {
      // Use raw fetch so we can always read the response body, even on non-2xx
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? SUPABASE_ANON_KEY

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-sprint-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(input),
        },
      )

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}: ${res.statusText}`)
      }
      if (json?.error) throw new Error(json.error)

      plan.value = json as SprintPlan
      return true
    } catch (e) {
      error.value = (e as Error).message
      return false
    } finally {
      generating.value = false
    }
  }

  /**
   * Commit the (possibly edited) plan to the database.
   * Inserts all sprints, their tasks, and task_assignments.
   * Returns true on success.
   */
  async function confirmPlan(projectId: string): Promise<boolean> {
    if (!plan.value) return false
    confirming.value = true
    error.value = null
    try {
      for (let i = 0; i < plan.value.sprints.length; i++) {
        const s = plan.value.sprints[i]

        // Insert sprint
        const { data: sprintRow, error: sprintError } = await supabase
          .from('sprints')
          .insert({
            project_id: projectId,
            name: s.name,
            goal: s.goal,
            start_date: s.start_date || null,
            end_date: s.end_date || null,
            status: 'planned',
            order: i,
          })
          .select('id')
          .single()

        if (sprintError) throw sprintError

        // Insert tasks for this sprint
        for (let j = 0; j < s.tasks.length; j++) {
          const t = s.tasks[j]

          const { data: taskRow, error: taskError } = await supabase
            .from('tasks')
            .insert({
              sprint_id: sprintRow.id,
              title: t.title,
              description: t.description,
              priority: t.priority,
              story_points: t.story_points,
              status: 'todo',
              order: j,
            })
            .select('id')
            .single()

          if (taskError) throw taskError

          // Insert assignment if one was suggested
          if (t.suggested_assignee_user_id) {
            const { error: assignError } = await supabase
              .from('task_assignments')
              .insert({
                task_id: taskRow.id,
                user_id: t.suggested_assignee_user_id,
                ai_suggested: true,
              })
            // Non-fatal: log but don't abort if assignment fails
            if (assignError) console.warn('task_assignment insert failed:', assignError.message)
          }
        }
      }
      return true
    } catch (e) {
      error.value = (e as Error).message
      return false
    } finally {
      confirming.value = false
    }
  }

  function resetPlan() {
    plan.value = null
    error.value = null
  }

  return {
    plan,
    generating,
    confirming,
    error,
    generatePlan,
    confirmPlan,
    resetPlan,
  }
}
