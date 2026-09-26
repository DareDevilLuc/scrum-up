<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useTeamsStore } from '@/stores/teams'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const teams = useTeamsStore()
const auth = useAuthStore()

const teamId = computed(() => route.params.id as string)

onMounted(async () => {
  await teams.fetchTeamDetail(teamId.value)
  await teams.fetchTeamMembers(teamId.value)
})

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}
</script>

<template>
  <div class="detail-page">
    <!-- Header -->
    <div class="page-header">
      <Button
        icon="pi pi-arrow-left"
        text
        class="back-btn"
        aria-label="Back to teams"
        @click="router.push({ name: 'teams' })"
      />
      <div class="header-content">
        <div>
          <h1 class="page-title">
            <i class="pi pi-users title-icon" />
            {{ teams.currentTeam?.name ?? 'Team' }}
          </h1>
          <p class="page-subtitle">{{ teams.currentMembers.length }} member{{ teams.currentMembers.length !== 1 ? 's' : '' }}</p>
        </div>
        <Button
          v-if="auth.role === 'super_admin'"
          label="Manage in Admin"
          icon="pi pi-cog"
          text
          @click="router.push({ name: 'admin-teams' })"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="teams.loading" class="centered">
      <ProgressSpinner />
    </div>

    <!-- Error -->
    <Message v-else-if="teams.error" severity="error" :closable="false">
      {{ teams.error }}
    </Message>

    <!-- Empty -->
    <div v-else-if="teams.currentMembers.length === 0" class="empty-state">
      <i class="pi pi-user empty-icon" />
      <p class="empty-text">No members in this team yet.</p>
    </div>

    <!-- Members grid -->
    <div v-else class="members-grid">
      <div
        v-for="member in teams.currentMembers"
        :key="member.user_id"
        class="member-card"
        @click="router.push({ name: 'profile', params: { userId: member.user_id } })"
      >
        <!-- Avatar -->
        <div class="member-avatar-wrap">
          <Avatar
            v-if="member.avatar_url"
            :image="member.avatar_url"
            shape="circle"
            size="large"
          />
          <Avatar
            v-else
            :label="initials(member.display_name)"
            shape="circle"
            size="large"
            class="avatar-fallback"
          />
        </div>

        <!-- Info -->
        <div class="member-info">
          <span class="member-name">{{ member.display_name ?? 'Unknown' }}</span>
          <a
            v-if="member.github_username"
            :href="`https://github.com/${member.github_username}`"
            target="_blank"
            rel="noopener"
            class="github-link"
            @click.stop
          >
            <i class="pi pi-github" />
            {{ member.github_username }}
          </a>
        </div>

        <!-- Tech stack tags -->
        <div v-if="member.tech_stack?.length" class="tech-stack">
          <Tag
            v-for="tag in member.tech_stack.slice(0, 4)"
            :key="tag"
            :value="tag"
            class="tech-tag"
          />
          <span v-if="member.tech_stack.length > 4" class="tech-more">
            +{{ member.tech_stack.length - 4 }}
          </span>
        </div>

        <div class="view-profile-hint">
          <i class="pi pi-external-link" /> View profile
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.back-btn { flex-shrink: 0; margin-top: 0.25rem; }

.header-content {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

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
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: var(--su-text-muted);
}

/* ── States ────────────────────────────────────────────────────────────────── */

.centered {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 4rem 0;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--su-border-glow);
  opacity: 0.5;
}

.empty-text {
  margin: 0;
  font-size: 0.95rem;
  color: var(--su-text-muted);
}

/* ── Members grid ──────────────────────────────────────────────────────────── */

.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.member-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  padding: 1.1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  text-align: center;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.1);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.member-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 16px 4px rgba(124, 58, 237, 0.35);
}

.member-avatar-wrap {
  margin-bottom: 0.15rem;
}

:deep(.avatar-fallback .p-avatar) {
  background: rgba(124, 58, 237, 0.25) !important;
  color: var(--su-purple-300) !important;
  font-weight: 700;
}

.member-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.member-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--su-text);
}

.github-link {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: var(--su-purple-300);
  text-decoration: none;
}

.github-link:hover { text-decoration: underline; }

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
}

:deep(.tech-tag.p-tag) {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.4);
  font-size: 0.68rem;
  padding: 0.1rem 0.45rem;
}

.tech-more {
  font-size: 0.72rem;
  color: var(--su-text-muted);
  align-self: center;
}

.view-profile-hint {
  font-size: 0.72rem;
  color: var(--su-text-muted);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
}
</style>
