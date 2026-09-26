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
      <div class="header-actions">
        <Button
          label="Create Team"
          icon="pi pi-plus"
          @click="router.push({ name: 'team-new' })"
        />
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
    <div v-else-if="teams.myTeams.length === 0" class="empty-state">
      <i class="pi pi-users empty-icon" />
      <p class="empty-text">You are not a member of any team yet.</p>
      <p class="empty-sub">Create a team to get started.</p>
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
  padding: 2rem 2rem 3rem;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (max-width: 600px) {
  .teams-page { padding: 1rem 0.75rem 2rem; }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--su-border);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.8);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.title-icon {
  color: var(--su-purple-400);
  filter: drop-shadow(0 0 4px rgba(168,85,247,0.7));
}

.centered {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 4rem 2rem;
  text-align: center;
  background: var(--su-bg-surface);
  border: 1px dashed rgba(124, 58, 237, 0.3);
  border-radius: 14px;
}

.empty-icon {
  font-size: 2.75rem;
  color: var(--su-border-glow);
  opacity: 0.55;
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
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 1.1rem;
}

.team-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 14px;
  padding: 1.35rem 1.5rem;
  cursor: pointer;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 14px 2px rgba(124, 58, 237, 0.1);
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  position: relative;
  overflow: hidden;
}

/* left accent line */
.team-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--su-purple-400), var(--su-purple-700));
  opacity: 0;
  transition: opacity 0.18s;
}

.team-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 20px 4px rgba(124, 58, 237, 0.3);
  transform: translateY(-2px);
}
.team-card:hover::before { opacity: 1; }

.team-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.team-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--su-text);
}

.card-arrow {
  font-size: 0.8rem;
  color: var(--su-purple-400);
  transition: transform 0.15s;
}

.team-card:hover .card-arrow { transform: translateX(3px); }

.team-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(42, 26, 78, 0.5);
}

.meta-chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--su-text-muted);
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.22);
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
}

.meta-date { opacity: 0.7; }
</style>
