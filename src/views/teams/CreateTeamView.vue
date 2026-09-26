<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Avatar from 'primevue/avatar'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// ── Form state ───────────────────────────────────────────────────────────────

const teamName = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)
const submitSuccess = ref(false)

// ── User search ──────────────────────────────────────────────────────────────

interface UserResult {
  id: string
  display_name: string | null
  avatar_url: string | null
  github_username: string | null
}

interface Invite {
  user: UserResult
  role: 'project_head' | 'developer'
}

const searchQuery = ref('')
const searchResults = ref<UserResult[]>([])
const searchLoading = ref(false)
const invites = ref<Invite[]>([])

const invitedIds = computed(() => invites.value.map((i) => i.user.id))

async function searchUsers() {
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchResults.value = []
    return
  }
  searchLoading.value = true
  try {
    const { data, error: sbError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, github_username')
      .or(`display_name.ilike.%${q}%,github_username.ilike.%${q}%`)
      .neq('id', auth.user!.id)
      .limit(8)

    if (sbError) throw sbError
    searchResults.value = data ?? []
  } catch (e) {
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

function addInvite(user: UserResult) {
  if (invitedIds.value.includes(user.id)) return
  invites.value.push({ user, role: 'developer' })
  searchQuery.value = ''
  searchResults.value = []
}

function removeInvite(userId: string) {
  invites.value = invites.value.filter((i) => i.user.id !== userId)
}

function toggleRole(inv: Invite) {
  inv.role = inv.role === 'developer' ? 'project_head' : 'developer'
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

// ── Submit ───────────────────────────────────────────────────────────────────

async function submit() {
  submitError.value = null
  const name = teamName.value.trim()
  if (!name) {
    submitError.value = 'Team name is required.'
    return
  }

  submitting.value = true
  try {
    const userId = auth.user!.id

    // 1. Create the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ name, created_by: userId })
      .select('id')
      .single()

    if (teamError) throw teamError
    const teamId = team.id

    // 2. Add creator as team member
    const { error: selfMemberError } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, user_id: userId })

    if (selfMemberError) throw selfMemberError

    // 3. Assign project_head role to creator (scoped to this team)
    await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'project_head',
      scope_type: 'team',
      scope_id: teamId,
    })

    // 4. Insert team_invitations for each invited user
    if (invites.value.length > 0) {
      const { error: inviteError } = await supabase.from('team_invitations').insert(
        invites.value.map((inv) => ({
          team_id: teamId,
          invited_by: userId,
          invited_user: inv.user.id,
          role: inv.role,
          status: 'pending',
        })),
      )
      if (inviteError) console.warn('[create-team] invite insert failed:', inviteError.message)
    }

    submitSuccess.value = true
    // Navigate to the new team's detail page
    setTimeout(() => router.push({ name: 'team-detail', params: { id: teamId } }), 800)
  } catch (e) {
    submitError.value = (e as Error).message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="create-page">
    <!-- Header -->
    <div class="page-header">
      <Button
        icon="pi pi-arrow-left"
        text
        class="back-btn"
        aria-label="Back to teams"
        @click="router.push({ name: 'teams' })"
      />
      <h1 class="page-title">
        <i class="pi pi-plus-circle title-icon" />
        Create a Team
      </h1>
    </div>

    <!-- Success -->
    <Message v-if="submitSuccess" severity="success" :closable="false">
      Team created! Redirecting…
    </Message>

    <!-- Form -->
    <div v-else class="form-card">
      <!-- Team name -->
      <div class="field">
        <label class="field-label" for="team-name">Team Name</label>
        <InputText
          id="team-name"
          v-model="teamName"
          placeholder="e.g. Phoenix Squad"
          class="field-input"
          :disabled="submitting"
          @keyup.enter="submit"
        />
      </div>

      <!-- Member search -->
      <div class="field">
        <label class="field-label">Invite Members <span class="field-hint">(optional)</span></label>
        <div class="search-wrap">
          <InputText
            v-model="searchQuery"
            placeholder="Search by name or GitHub username…"
            class="field-input"
            :disabled="submitting"
            @input="searchUsers"
          />
          <div v-if="searchLoading" class="search-spinner">
            <i class="pi pi-spinner pi-spin" />
          </div>
        </div>

        <!-- Search results dropdown -->
        <div v-if="searchResults.length > 0" class="search-results">
          <div
            v-for="u in searchResults"
            :key="u.id"
            class="search-result-row"
            :class="{ 'result-added': invitedIds.includes(u.id) }"
            @click="addInvite(u)"
          >
            <Avatar
              v-if="u.avatar_url"
              :image="u.avatar_url"
              shape="circle"
              size="small"
            />
            <Avatar
              v-else
              :label="initials(u.display_name)"
              shape="circle"
              size="small"
              class="avatar-fallback"
            />
            <span class="result-name">{{ u.display_name ?? u.github_username ?? 'Unknown' }}</span>
            <span v-if="u.github_username" class="result-github">@{{ u.github_username }}</span>
            <i
              class="result-icon pi"
              :class="invitedIds.includes(u.id) ? 'pi-check' : 'pi-plus'"
            />
          </div>
        </div>
      </div>

      <!-- Invited members list -->
      <div v-if="invites.length > 0" class="invites-section">
        <p class="invites-label">Invited members</p>
        <div class="invites-list">
          <div v-for="inv in invites" :key="inv.user.id" class="invite-row">
            <Avatar
              v-if="inv.user.avatar_url"
              :image="inv.user.avatar_url"
              shape="circle"
              size="small"
            />
            <Avatar
              v-else
              :label="initials(inv.user.display_name)"
              shape="circle"
              size="small"
              class="avatar-fallback"
            />
            <span class="invite-name">{{ inv.user.display_name ?? inv.user.github_username ?? 'Unknown' }}</span>
            <!-- Role toggle -->
            <button class="role-toggle" :class="`role-toggle--${inv.role}`" @click="toggleRole(inv)">
              {{ inv.role === 'project_head' ? 'Project Head' : 'Developer' }}
              <i class="pi pi-refresh" />
            </button>
            <Button
              icon="pi pi-times"
              text
              severity="danger"
              size="small"
              class="remove-btn"
              aria-label="Remove invite"
              @click="removeInvite(inv.user.id)"
            />
          </div>
        </div>
      </div>

      <!-- Error -->
      <Message v-if="submitError" severity="error" :closable="false" class="submit-error">
        {{ submitError }}
      </Message>

      <!-- Submit -->
      <div class="form-actions">
        <Button
          label="Create Team"
          icon="pi pi-check"
          :loading="submitting"
          :disabled="!teamName.trim() || submitting"
          @click="submit"
        />
        <Button
          label="Cancel"
          text
          :disabled="submitting"
          @click="router.push({ name: 'teams' })"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 680px;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */

.page-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-btn { flex-shrink: 0; }

.page-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.8);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon { color: var(--su-purple-400); }

/* ── Card ───────────────────────────────────────────────────────────────────── */

.form-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 20px 4px rgba(124, 58, 237, 0.12);
}

/* ── Fields ─────────────────────────────────────────────────────────────────── */

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--su-purple-300);
}

.field-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--su-text-muted);
}

.field-input {
  width: 100%;
}

:deep(.field-input.p-inputtext) {
  background: var(--su-bg-elevated);
  border-color: var(--su-border);
  color: var(--su-text);
}

:deep(.field-input.p-inputtext:focus) {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

/* ── Search ─────────────────────────────────────────────────────────────────── */

.search-wrap {
  position: relative;
}

.search-spinner {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--su-text-muted);
  font-size: 0.85rem;
}

.search-results {
  margin-top: 0.35rem;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  overflow: hidden;
}

.search-result-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem;
  cursor: pointer;
  transition: background 0.1s;
}

.search-result-row:hover {
  background: rgba(124, 58, 237, 0.12);
}

.result-added {
  opacity: 0.5;
  cursor: default;
}

.result-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--su-text);
}

.result-github {
  font-size: 0.78rem;
  color: var(--su-text-muted);
  flex: 1;
}

.result-icon {
  font-size: 0.8rem;
  color: var(--su-purple-300);
  margin-left: auto;
}

:deep(.avatar-fallback .p-avatar) {
  background: rgba(124, 58, 237, 0.25) !important;
  color: var(--su-purple-300) !important;
  font-weight: 700;
}

/* ── Invites list ───────────────────────────────────────────────────────────── */

.invites-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invites-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--su-text-muted);
  margin: 0;
}

.invites-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.invite-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.invite-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--su-text);
  flex: 1;
}

.role-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  transition: background 0.1s, border-color 0.1s;
}

.role-toggle--developer {
  color: var(--su-purple-300);
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.1);
}

.role-toggle--developer:hover {
  background: rgba(124, 58, 237, 0.22);
}

.role-toggle--project_head {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.1);
}

.role-toggle--project_head:hover {
  background: rgba(251, 191, 36, 0.22);
}

.remove-btn { flex-shrink: 0; }

/* ── Submit ─────────────────────────────────────────────────────────────────── */

.submit-error { margin: 0; }

.form-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 0.25rem;
}
</style>
