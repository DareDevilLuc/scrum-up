import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Local types ───────────────────────────────────────────────────────────────

export interface MyTeam {
  id: string
  name: string
  created_at: string
  member_count: number
  project_count: number
}

export interface TeamDetail {
  id: string
  name: string
  created_at: string
}

export interface TeamMemberProfile {
  user_id: string
  joined_at: string
  display_name: string | null
  avatar_url: string | null
  github_username: string | null
  tech_stack: string[] | null
  role: 'project_head' | 'developer' | 'super_admin' | null
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTeamsStore = defineStore('teams', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const myTeams = ref<MyTeam[]>([])
  const currentTeam = ref<TeamDetail | null>(null)
  const currentMembers = ref<TeamMemberProfile[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetch all teams the current user is a member of.
   * Also fetches member count and project count for each team.
   */
  async function fetchMyTeams() {
    const auth = useAuthStore()
    loading.value = true
    error.value = null
    try {
      // Get team IDs the current user belongs to
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', auth.user!.id)

      if (memberError) throw memberError

      const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id)
      if (teamIds.length === 0) {
        myTeams.value = []
        return
      }

      // Fetch the team rows
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, created_at')
        .in('id', teamIds)
        .order('created_at', { ascending: false })

      if (teamsError) throw teamsError

      // Fetch member counts for these teams
      const { data: allMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)

      const memberCountMap: Record<string, number> = {}
      for (const m of allMembers ?? []) {
        memberCountMap[m.team_id] = (memberCountMap[m.team_id] ?? 0) + 1
      }

      // Fetch project counts for these teams
      const { data: allProjects } = await supabase
        .from('projects')
        .select('team_id')
        .in('team_id', teamIds)

      const projectCountMap: Record<string, number> = {}
      for (const p of allProjects ?? []) {
        if (p.team_id) projectCountMap[p.team_id] = (projectCountMap[p.team_id] ?? 0) + 1
      }

      myTeams.value = (teamsData ?? []).map((t) => ({
        ...t,
        member_count: memberCountMap[t.id] ?? 0,
        project_count: projectCountMap[t.id] ?? 0,
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Fetch a single team's detail row. */
  async function fetchTeamDetail(teamId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('teams')
        .select('id, name, created_at')
        .eq('id', teamId)
        .single()

      if (sbError) throw sbError
      currentTeam.value = data
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Fetch all members of a team, joined with their developer profile data. */
  async function fetchTeamMembers(teamId: string) {
    loading.value = true
    error.value = null
    try {
      // Join team_members → users → developer_profiles
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          joined_at,
          users (
            display_name,
            avatar_url,
            github_username
          )
        `)
        .eq('team_id', teamId)

      if (membersError) throw membersError

      const userIds = (membersData ?? []).map((m: any) => m.user_id)

      // Fetch developer_profiles for the skill tags
      let profileMap: Record<string, string[] | null> = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('developer_profiles')
          .select('user_id, tech_stack')
          .in('user_id', userIds)

        for (const p of profiles ?? []) {
          profileMap[p.user_id] = p.tech_stack
        }
      }

      // Fetch roles: look for project_head scoped to this team, or super_admin global
      let roleMap: Record<string, 'project_head' | 'developer' | 'super_admin'> = {}
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role, scope_type, scope_id')
          .in('user_id', userIds)

        for (const r of rolesData ?? []) {
          const existing = roleMap[r.user_id]
          // Priority: super_admin > project_head > developer
          if (r.role === 'super_admin' && r.scope_type === 'global') {
            roleMap[r.user_id] = 'super_admin'
          } else if (
            r.role === 'project_head' &&
            (r.scope_id === teamId || r.scope_type === 'global') &&
            existing !== 'super_admin'
          ) {
            roleMap[r.user_id] = 'project_head'
          } else if (!existing) {
            roleMap[r.user_id] = 'developer'
          }
        }
      }

      currentMembers.value = (membersData ?? []).map((m: any) => ({
        user_id: m.user_id,
        joined_at: m.joined_at,
        display_name: m.users?.display_name ?? null,
        avatar_url: m.users?.avatar_url ?? null,
        github_username: m.users?.github_username ?? null,
        tech_stack: profileMap[m.user_id] ?? null,
        role: roleMap[m.user_id] ?? 'developer',
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function $reset() {
    myTeams.value = []
    currentTeam.value = null
    currentMembers.value = []
    loading.value = false
    error.value = null
  }

  return {
    myTeams,
    currentTeam,
    currentMembers,
    loading,
    error,
    fetchMyTeams,
    fetchTeamDetail,
    fetchTeamMembers,
    $reset,
  }
})
