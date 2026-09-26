<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useTeamsStore } from '@/stores/teams'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const teams = useTeamsStore()
const auth = useAuthStore()

onMounted(() => teams.fetchMyTeams())

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="teams-page">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">
        <i class="pi pi-users title-icon" />
        My Teams
      </h1>
      <Button
        v-if="auth.role === 'super_admin'"
        label="Manage in Admin"
        icon="pi pi-cog"
        text
        @click="router.push({ name: 'admin-teams' })"
      />
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
    <div v-else-if="teams.myTeams.length === 0" class="empty-state">
      <i class="pi pi-users empty-icon" />
      <p class="empty-text">You are not a member of any team yet.</p>
      <p v-if="auth.role === 'super_admin'" class="empty-sub">
        Go to <a class="link" @click="router.push({ name: 'admin-teams' })">Admin → Teams</a> to create one.
      </p>
    </div>

    <!-- Team cards -->
    <div v-else class="teams-grid">
      <div
        v-for="team in teams.myTeams"
        :key="team.id"
        class="team-card"
        @click="router.push({ name: 'team-detail', params: { id: team.id } })"
      >
        <div class="team-card-header">
          <span class="team-name">{{ team.name }}</span>
          <i class="pi pi-chevron-right card-arrow" />
        </div>
        <div class="team-meta">
          <span class="meta-chip">
            <i class="pi pi-user" />
            {{ team.member_count }} member{{ team.member_count !== 1 ? 's' : '' }}
          </span>
          <span class="meta-chip">
            <i class="pi pi-folder" />
            {{ team.project_count }} project{{ team.project_count !== 1 ? 's' : '' }}
          </span>
          <span class="meta-chip meta-date">
            <i class="pi pi-calendar" />
            {{ formatDate(team.created_at) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.teams-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
  display: flex;
  align-items: center;
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

.empty-sub {
  margin: 0;
  font-size: 0.82rem;
  color: var(--su-text-muted);
}

.link {
  color: var(--su-purple-300);
  cursor: pointer;
  text-decoration: underline;
}

/* ── Cards ─────────────────────────────────────────────────────────────────── */

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.team-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  padding: 1rem 1.1rem;
  cursor: pointer;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.1);
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.team-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 16px 4px rgba(124, 58, 237, 0.35);
}

.team-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.team-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--su-text);
}

.card-arrow {
  font-size: 0.75rem;
  color: var(--su-text-muted);
}

.team-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--su-text-muted);
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.2);
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
}

.meta-date { opacity: 0.7; }
</style>
