import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

// ── Local types (no generated DB types yet) ───────────────────────────────────

export interface AdminUser {
  id: string
  display_name: string | null
  avatar_url: string | null
  github_username: string | null
  created_at: string
  roles: UserRole[]
}

export interface UserRole {
  id: string
  user_id: string
  role: 'super_admin' | 'project_head' | 'developer'
  scope_type: 'global' | 'team' | 'project'
  scope_id: string | null
}

export interface Team {
  id: string
  name: string
  created_by: string
  created_at: string
  member_count?: number
}

export interface TeamMember {
  user_id: string
  joined_at: string
  users: {
    id: string
    display_name: string | null
    avatar_url: string | null
    github_username: string | null
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAdminStore = defineStore('admin', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const users = ref<AdminUser[]>([])
  const teams = ref<Team[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Actions ────────────────────────────────────────────────────────────────

  async function fetchUsers() {
    loading.value = true
    error.value = null
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, github_username, created_at')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, scope_type, scope_id')

      if (rolesError) throw rolesError

      users.value = (usersData ?? []).map((u) => ({
        ...u,
        roles: (rolesData ?? []).filter((r) => r.user_id === u.id) as UserRole[],
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function fetchTeams() {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('teams')
        .select('id, name, created_by, created_at')
        .order('created_at', { ascending: false })

      if (sbError) throw sbError

      // Fetch member counts via team_members
      const teamIds = (data ?? []).map((t) => t.id)
      let countMap: Record<string, number> = {}
      if (teamIds.length > 0) {
        const { data: members } = await supabase
          .from('team_members')
          .select('team_id')
          .in('team_id', teamIds)

        for (const m of members ?? []) {
          countMap[m.team_id] = (countMap[m.team_id] ?? 0) + 1
        }
      }

      teams.value = (data ?? []).map((t) => ({
        ...t,
        member_count: countMap[t.id] ?? 0,
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /**
   * Assign (or update) a role for a user. Upserts into user_roles.
   * For super_admin the scope_type is always 'global' and scope_id is null.
   * For project_head it is 'team' with the given scopeId.
   */
  async function assignRole(
    userId: string,
    role: 'super_admin' | 'project_head' | 'developer',
    scopeId: string | null = null,
  ) {
    const scopeType = role === 'super_admin' ? 'global' : scopeId ? 'team' : 'global'

    const { data, error: sbError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role, scope_type: scopeType, scope_id: scopeId })
      .select()
      .single()

    if (sbError) {
      error.value = sbError.message
      return false
    }

    // Optimistically update local users array
    const user = users.value.find((u) => u.id === userId)
    if (user && data) {
      user.roles.push(data as UserRole)
    }
    return true
  }

  async function removeRole(roleId: string, userId: string) {
    const { error: sbError } = await supabase.from('user_roles').delete().eq('id', roleId)

    if (sbError) {
      error.value = sbError.message
      return false
    }

    const user = users.value.find((u) => u.id === userId)
    if (user) {
      user.roles = user.roles.filter((r) => r.id !== roleId)
    }
    return true
  }

  async function createTeam(name: string, memberIds: string[], createdBy: string) {
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ name, created_by: createdBy })
      .select()
      .single()

    if (teamError) {
      error.value = teamError.message
      return null
    }

    if (memberIds.length > 0) {
      const { error: memberError } = await supabase.from('team_members').insert(
        memberIds.map((uid) => ({ team_id: team.id, user_id: uid })),
      )
      if (memberError) console.warn('[admin] partial member insert failed:', memberError.message)
    }

    teams.value.unshift({ ...team, member_count: memberIds.length })
    return team
  }

  async function updateTeam(teamId: string, name: string) {
    const { error: sbError } = await supabase
      .from('teams')
      .update({ name })
      .eq('id', teamId)

    if (sbError) {
      error.value = sbError.message
      return false
    }

    const t = teams.value.find((t) => t.id === teamId)
    if (t) t.name = name
    return true
  }

  async function deleteTeam(teamId: string) {
    const { error: sbError } = await supabase.from('teams').delete().eq('id', teamId)
    if (sbError) {
      error.value = sbError.message
      return false
    }
    teams.value = teams.value.filter((t) => t.id !== teamId)
    return true
  }

  return {
    users,
    teams,
    loading,
    error,
    fetchUsers,
    fetchTeams,
    assignRole,
    removeRole,
    createTeam,
    updateTeam,
    deleteTeam,
  }
})
