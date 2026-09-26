<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useInvitationsStore } from '@/stores/invitations'
import type { TeamInvitation } from '@/stores/invitations'

const router = useRouter()
const store = useInvitationsStore()

onMounted(() => store.fetchPending())

// Per-card action loading state
const actionLoading = ref<Record<string, 'accept' | 'decline' | null>>({})
const actionError = ref<Record<string, string | null>>({})

async function accept(inv: TeamInvitation) {
  actionLoading.value[inv.id] = 'accept'
  actionError.value[inv.id] = null
  try {
    await store.accept(inv.id)
  } catch (e) {
    actionError.value[inv.id] = (e as Error).message
  } finally {
    actionLoading.value[inv.id] = null
  }
}

async function decline(inv: TeamInvitation) {
  actionLoading.value[inv.id] = 'decline'
  actionError.value[inv.id] = null
  try {
    await store.decline(inv.id)
  } catch (e) {
    actionError.value[inv.id] = (e as Error).message
  } finally {
    actionLoading.value[inv.id] = null
  }
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

function roleLabel(role: string): string {
  return role === 'project_head' ? 'Project Head' : 'Developer'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>

<template>
  <div class="inbox-page">
    <!-- Header -->
    <div class="page-header">
      <Button
        icon="pi pi-arrow-left"
        text
        class="back-btn"
        aria-label="Back to dashboard"
        @click="router.push({ name: 'dashboard' })"
      />
      <div>
        <h1 class="page-title">
          <i class="pi pi-inbox title-icon" />
          Inbox
        </h1>
        <p class="page-subtitle">Team invitations waiting for your response</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="centered">
      <ProgressSpinner />
    </div>

    <!-- Store-level error -->
    <Message v-else-if="store.error" severity="error" :closable="false">
      {{ store.error }}
    </Message>

    <!-- Empty state -->
    <div v-else-if="store.pending.length === 0" class="empty-state">
      <i class="pi pi-check-circle empty-icon" />
      <p class="empty-title">All clear!</p>
      <p class="empty-text">You have no pending team invitations.</p>
    </div>

    <!-- Invitation cards -->
    <div v-else class="invite-list">
      <div
        v-for="inv in store.pending"
        :key="inv.id"
        class="invite-card"
      >
        <!-- Inviter info -->
        <div class="invite-card-top">
          <Avatar
            v-if="inv.inviter_avatar"
            :image="inv.inviter_avatar"
            shape="circle"
            size="large"
          />
          <Avatar
            v-else
            :label="initials(inv.inviter_name)"
            shape="circle"
            size="large"
            class="avatar-fallback"
          />
          <div class="invite-meta">
            <p class="invite-from">
              <span class="invite-inviter">{{ inv.inviter_name ?? 'Someone' }}</span>
              invited you to join
            </p>
            <p class="invite-team">
              <i class="pi pi-users" />
              {{ inv.team_name ?? 'a team' }}
            </p>
            <div class="invite-tags">
              <span class="role-badge" :class="inv.role === 'project_head' ? 'badge--head' : 'badge--dev'">
                {{ roleLabel(inv.role) }}
              </span>
              <span class="time-badge">{{ timeAgo(inv.created_at) }}</span>
            </div>
          </div>
        </div>

        <!-- Per-card error -->
        <Message
          v-if="actionError[inv.id]"
          severity="error"
          :closable="false"
          class="card-error"
        >
          {{ actionError[inv.id] }}
        </Message>

        <!-- Actions -->
        <div class="invite-actions">
          <Button
            label="Accept"
            icon="pi pi-check"
            size="small"
            :loading="actionLoading[inv.id] === 'accept'"
            :disabled="!!actionLoading[inv.id]"
            class="accept-btn"
            @click="accept(inv)"
          />
          <Button
            label="Decline"
            icon="pi pi-times"
            text
            severity="secondary"
            size="small"
            :loading="actionLoading[inv.id] === 'decline'"
            :disabled="!!actionLoading[inv.id]"
            @click="decline(inv)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inbox-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 680px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────────────────────── */

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.back-btn { flex-shrink: 0; margin-top: 0.2rem; }

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

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--su-text-muted);
}

/* ── States ──────────────────────────────────────────────────────────────────── */

.centered {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 4rem 0;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--su-success);
  opacity: 0.6;
}

.empty-title {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--su-text);
}

.empty-text {
  margin: 0;
  font-size: 0.88rem;
  color: var(--su-text-muted);
}

/* ── Invitation list ─────────────────────────────────────────────────────────── */

.invite-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.invite-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 16px 2px rgba(124, 58, 237, 0.1);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.invite-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 18px 4px rgba(124, 58, 237, 0.25);
}

/* ── Card top section ────────────────────────────────────────────────────────── */

.invite-card-top {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

:deep(.avatar-fallback .p-avatar) {
  background: rgba(124, 58, 237, 0.25) !important;
  color: var(--su-purple-300) !important;
  font-weight: 700;
}

.invite-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.invite-from {
  margin: 0;
  font-size: 0.9rem;
  color: var(--su-text-muted);
}

.invite-inviter {
  font-weight: 700;
  color: var(--su-text);
}

.invite-team {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--su-purple-300);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.invite-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.role-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 0.12rem 0.55rem;
}

.badge--head {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.35);
}

.badge--dev {
  background: rgba(124, 58, 237, 0.15);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.35);
}

.time-badge {
  font-size: 0.72rem;
  color: var(--su-text-muted);
}

/* ── Card error ──────────────────────────────────────────────────────────────── */

.card-error { margin: 0; }

/* ── Card actions ────────────────────────────────────────────────────────────── */

.invite-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

:deep(.accept-btn.p-button) {
  background: linear-gradient(135deg, #4c1d95, #7c3aed);
  border-color: var(--su-border-glow);
  color: var(--su-purple-200);
}

:deep(.accept-btn.p-button:hover) {
  background: linear-gradient(135deg, #5b21b6, #a855f7);
}
</style>
