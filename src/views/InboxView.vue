<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useInvitationsStore } from '@/stores/invitations'
import { useNotificationsStore } from '@/stores/notifications'
import type { TeamInvitation } from '@/stores/invitations'

const router = useRouter()
const invStore = useInvitationsStore()
const notifStore = useNotificationsStore()

onMounted(async () => {
  await Promise.all([invStore.fetchPending(), notifStore.fetchAll()])
})

// ── Invitation actions ────────────────────────────────────────────────────────

const actionLoading = ref<Record<string, 'accept' | 'decline' | null>>({})
const actionError = ref<Record<string, string | null>>({})

async function accept(inv: TeamInvitation) {
  actionLoading.value[inv.id] = 'accept'
  actionError.value[inv.id] = null
  try {
    await invStore.accept(inv.id)
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
    await invStore.decline(inv.id)
  } catch (e) {
    actionError.value[inv.id] = (e as Error).message
  } finally {
    actionLoading.value[inv.id] = null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function notifIcon(type: string): string {
  if (type === 'kicked') return 'pi pi-user-minus'
  if (type === 'team_deleted') return 'pi pi-trash'
  return 'pi pi-bell'
}

function notifClass(type: string): string {
  if (type === 'kicked' || type === 'team_deleted') return 'notif--danger'
  return 'notif--info'
}

const loading = () => invStore.loading || notifStore.loading
const isEmpty = () =>
  !invStore.loading &&
  !notifStore.loading &&
  invStore.pending.length === 0 &&
  notifStore.items.length === 0
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
      <div class="header-text">
        <h1 class="page-title">
          <i class="pi pi-inbox title-icon" />
          Inbox
        </h1>
        <p class="page-subtitle">Invitations and team notifications</p>
      </div>
      <Button
        v-if="notifStore.unreadCount > 0"
        label="Mark all read"
        icon="pi pi-check-circle"
        text
        size="small"
        class="mark-all-btn"
        @click="notifStore.markAllRead()"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading()" class="centered">
      <ProgressSpinner />
    </div>

    <!-- Empty state -->
    <div v-else-if="isEmpty()" class="empty-state">
      <i class="pi pi-check-circle empty-icon" />
      <p class="empty-title">All clear!</p>
      <p class="empty-text">No pending invitations or notifications.</p>
    </div>

    <template v-else>

      <!-- ── Pending Invitations ───────────────────────────────────────────── -->
      <section v-if="invStore.pending.length > 0" class="inbox-section">
        <h2 class="section-label">
          <i class="pi pi-envelope" />
          Team Invitations
          <span class="section-badge">{{ invStore.pending.length }}</span>
        </h2>

        <div class="invite-list">
          <div
            v-for="inv in invStore.pending"
            :key="inv.id"
            class="invite-card"
          >
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

            <Message
              v-if="actionError[inv.id]"
              severity="error"
              :closable="false"
              class="card-error"
            >
              {{ actionError[inv.id] }}
            </Message>

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
      </section>

      <!-- ── Notifications ─────────────────────────────────────────────────── -->
      <section v-if="notifStore.items.length > 0" class="inbox-section">
        <h2 class="section-label">
          <i class="pi pi-bell" />
          Notifications
          <span v-if="notifStore.unreadCount > 0" class="section-badge section-badge--danger">
            {{ notifStore.unreadCount }} unread
          </span>
        </h2>

        <div class="notif-list">
          <div
            v-for="notif in notifStore.items"
            :key="notif.id"
            class="notif-card"
            :class="{ 'notif-card--unread': !notif.is_read }"
            @click="notifStore.markRead(notif.id)"
          >
            <div class="notif-icon-wrap" :class="notifClass(notif.type)">
              <i :class="notifIcon(notif.type)" />
            </div>
            <div class="notif-content">
              <p class="notif-title">{{ notif.title }}</p>
              <p class="notif-body">{{ notif.body }}</p>
              <span class="notif-time">{{ timeAgo(notif.created_at) }}</span>
            </div>
            <div v-if="!notif.is_read" class="unread-dot" />
          </div>
        </div>
      </section>

    </template>
  </div>
</template>

<style scoped>
.inbox-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.header-text { flex: 1; }

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

.mark-all-btn { flex-shrink: 0; margin-top: 0.15rem; }

/* ── States ──────────────────────────────────────────────────────────────────── */

.centered { display: flex; justify-content: center; padding: 4rem 0; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 4rem 0;
  text-align: center;
}

.empty-icon { font-size: 2.5rem; color: var(--su-success); opacity: 0.6; }
.empty-title { margin: 0.25rem 0 0; font-size: 1rem; font-weight: 700; color: var(--su-text); }
.empty-text  { margin: 0; font-size: 0.88rem; color: var(--su-text-muted); }

/* ── Sections ────────────────────────────────────────────────────────────────── */

.inbox-section { display: flex; flex-direction: column; gap: 0.75rem; }

.section-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--su-purple-300);
  margin: 0;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--su-border);
}

.section-badge {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.05rem 0.45rem;
}

.section-badge--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* ── Invitation cards ────────────────────────────────────────────────────────── */

.invite-list { display: flex; flex-direction: column; gap: 0.9rem; }

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

.invite-card-top { display: flex; align-items: flex-start; gap: 1rem; }

:deep(.avatar-fallback .p-avatar) {
  background: rgba(124, 58, 237, 0.25) !important;
  color: var(--su-purple-300) !important;
  font-weight: 700;
}

.invite-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }

.invite-from { margin: 0; font-size: 0.9rem; color: var(--su-text-muted); }
.invite-inviter { font-weight: 700; color: var(--su-text); }

.invite-team {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--su-purple-300);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.invite-tags { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

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

.time-badge { font-size: 0.72rem; color: var(--su-text-muted); }

.card-error { margin: 0; }

.invite-actions { display: flex; align-items: center; gap: 0.6rem; }

:deep(.accept-btn.p-button) {
  background: linear-gradient(135deg, #4c1d95, #7c3aed);
  border-color: var(--su-border-glow);
  color: var(--su-purple-200);
}
:deep(.accept-btn.p-button:hover) {
  background: linear-gradient(135deg, #5b21b6, #a855f7);
}

/* ── Notification cards ──────────────────────────────────────────────────────── */

.notif-list { display: flex; flex-direction: column; gap: 0.5rem; }

.notif-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  padding: 0.9rem 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  position: relative;
}

.notif-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 12px 2px rgba(124, 58, 237, 0.2);
}

.notif-card--unread {
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.04);
}

.notif-icon-wrap {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.notif--danger {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.notif--info {
  background: rgba(124, 58, 237, 0.15);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.3);
}

.notif-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }

.notif-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--su-text);
}

.notif-body {
  margin: 0;
  font-size: 0.82rem;
  color: var(--su-text-muted);
  line-height: 1.5;
}

.notif-time {
  font-size: 0.7rem;
  color: var(--su-text-muted);
  margin-top: 0.1rem;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--su-purple-400);
  box-shadow: 0 0 6px rgba(168, 85, 247, 0.7);
  flex-shrink: 0;
  margin-top: 0.35rem;
}
</style>
