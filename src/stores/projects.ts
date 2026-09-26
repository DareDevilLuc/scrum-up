import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Local types ───────────────────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on_hold'

export interface ProjectListItem {
  id: string
  name: string
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  created_at: string
  client_id: string | null
  team_id: string | null
  client_name: string | null
  team_name: string | null
}

export interface ProjectDetail {
  id: string
  name: string
  requirements: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  created_at: string
  client_id: string | null
  team_id: string | null
  created_by: string | null
  client_name: string | null
  team_name: string | null
}

export interface ClientOption {
  id: string
  name: string
  contact_email: string | null
}

export interface CreateProjectPayload {
  name: string
  requirements: string
  team_id: string
  start_date: string
  end_date: string
  // client fields — one of these must be set
  client_id?: string | null
  client_name?: string
  client_contact_email?: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useProjectsStore = defineStore('projects', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const myProjects = ref<ProjectListItem[]>([])
  const currentProject = ref<ProjectDetail | null>(null)
  const clients = ref<ClientOption[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetch all projects the current user is associated with —
   * either as project head or as a team member.
   */
  async function fetchMyProjects() {
    const auth = useAuthStore()
    loading.value = true
    error.value = null
    try {
      const userId = auth.user!.id

      // Projects where current user is the head
      const { data: headProjects, error: headError } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date, created_at, client_id, team_id, clients(name), teams(name)')
        .eq('created_by', userId)

      if (headError) throw headError

      // Team IDs the user is a member of
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)

      const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id)

      let teamProjects: any[] = []
      if (teamIds.length > 0) {
        const { data: tp, error: tpError } = await supabase
          .from('projects')
          .select('id, name, status, start_date, end_date, created_at, client_id, team_id, clients(name), teams(name)')
          .in('team_id', teamIds)
          .neq('created_by', userId) // avoid duplicates with headProjects

        if (tpError) throw tpError
        teamProjects = tp ?? []
      }

      const all = [...(headProjects ?? []), ...teamProjects]

      myProjects.value = all.map((p: any) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        start_date: p.start_date,
        end_date: p.end_date,
        created_at: p.created_at,
        client_id: p.client_id,
        team_id: p.team_id,
        client_name: p.clients?.name ?? null,
        team_name: p.teams?.name ?? null,
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /**
   * Upsert client if new, then insert the project row.
   * Returns the new project id, or null on failure.
   */
  async function createProject(payload: CreateProjectPayload): Promise<string | null> {
    const auth = useAuthStore()
    loading.value = true
    error.value = null
    try {
      let clientId = payload.client_id ?? null

      // Create a new client if a name was provided without an existing id
      if (!clientId && payload.client_name) {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: payload.client_name,
            contact_email: payload.client_contact_email ?? null,
          })
          .select('id')
          .single()

        if (clientError) throw clientError
        clientId = newClient.id
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: payload.name,
          requirements: payload.requirements,
          team_id: payload.team_id,
          start_date: payload.start_date,
          end_date: payload.end_date,
          client_id: clientId,
          created_by: auth.user!.id,
          status: 'planning' as ProjectStatus,
        })
        .select('id')
        .single()

      if (projectError) throw projectError
      return project.id
    } catch (e) {
      error.value = (e as Error).message
      return null
    } finally {
      loading.value = false
    }
  }

  /** Fetch a single project's detail row for the project page shell. */
  async function fetchProjectDetail(id: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('projects')
        .select('id, name, requirements, status, start_date, end_date, created_at, client_id, team_id, created_by, clients(name), teams(name)')
        .eq('id', id)
        .single()

      if (sbError) throw sbError

      currentProject.value = {
        ...data,
        client_name: (data as any).clients?.name ?? null,
        team_name: (data as any).teams?.name ?? null,
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Fetch all existing clients for the autocomplete dropdown. */
  async function fetchClients() {
    const { data, error: sbError } = await supabase
      .from('clients')
      .select('id, name, contact_email')
      .order('name', { ascending: true })

    if (!sbError) {
      clients.value = data ?? []
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function $reset() {
    myProjects.value = []
    currentProject.value = null
    clients.value = []
    loading.value = false
    error.value = null
  }

  return {
    myProjects,
    currentProject,
    clients,
    loading,
    error,
    fetchMyProjects,
    createProject,
    fetchProjectDetail,
    fetchClients,
    $reset,
  }
})
