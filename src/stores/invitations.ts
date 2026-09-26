import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamInvitation {
  id: string
  team_id: string
  invited_by: string
  invited_user: string
  role: 'project_head' | 'developer'
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  team_name: string | null
  inviter_name: string | null
  inviter_avatar: string | null
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useInvitationsStore = defineStore('invitations', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const pending = ref<TeamInvitation[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Fetch all pending invitations for the current user. */
  async function fetchPending() {
    const auth = useAuthStore()
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('team_invitations')
        .select(`
          id,
          team_id,
          invited_by,
          invited_user,
          role,
          status,
          created_at,
          teams ( name ),
          users!team_invitations_invited_by_fkey ( display_name, avatar_url )
        `)
        .eq('invited_user', auth.user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (sbError) throw sbError

      pending.value = (data ?? []).map((row: any) => ({
        id: row.id,
        team_id: row.team_id,
        invited_by: row.invited_by,
        invited_user: row.invited_user,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        team_name: row.teams?.name ?? null,
        inviter_name: row.users?.display_name ?? null,
        inviter_avatar: row.users?.avatar_url ?? null,
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Accept an invitation: mark it accepted and add the user to the team. */
  async function accept(invitationId: string) {
    const auth = useAuthStore()
    const inv = pending.value.find((i) => i.id === invitationId)
    if (!inv) return

    try {
      // 1. Mark invitation accepted
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId)
        .eq('invited_user', auth.user!.id)

      if (updateError) throw updateError

      // 2. Add user to team_members (ignore conflict if already a member)
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: inv.team_id, user_id: auth.user!.id })

      if (memberError && !memberError.message.includes('duplicate')) {
        throw memberError
      }

      // 3. Assign the role to the user (scoped to team)
      await supabase.from('user_roles').insert({
        user_id: auth.user!.id,
        role: inv.role,
        scope_type: 'team',
        scope_id: inv.team_id,
      })

      // Remove from local pending list
      pending.value = pending.value.filter((i) => i.id !== invitationId)
    } catch (e) {
      error.value = (e as Error).message
      throw e
    }
  }

  /** Decline an invitation: mark it declined. */
  async function decline(invitationId: string) {
    const auth = useAuthStore()
    try {
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId)
        .eq('invited_user', auth.user!.id)

      if (updateError) throw updateError

      // Remove from local pending list
      pending.value = pending.value.filter((i) => i.id !== invitationId)
    } catch (e) {
      error.value = (e as Error).message
      throw e
    }
  }

  function $reset() {
    pending.value = []
    loading.value = false
    error.value = null
  }

  return {
    pending,
    loading,
    error,
    fetchPending,
    accept,
    decline,
    $reset,
  }
})
