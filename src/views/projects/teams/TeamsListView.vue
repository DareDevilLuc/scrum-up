<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useTeamsStore } from '@/stores/teams'
import { useAuthStore } from '@/stores/auth'

const teamsStore = useTeamsStore()
const authStore = useAuthStore()
const router = useRouter()

onMounted(async () => {
  await teamsStore.fetchMyTeams()
})

function goToTeam(teamId: string) {
  router.push({ name: 'team-detail', params: { id: teamId } })
}
</script>

<template>
  <div class="teams-list-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Teams</h1>
        <p class="page-subtitle">Teams you are a member of.</p>
      </div>
      <Button
        v-if="authStore.role === 'super_admin'"
        label="Manage in Admin"
        icon="pi pi-shield"
        outlined
        @click="router.push('/admin/teams')"
      />
    </div>

    <Message v-if="teamsStore.error" severity="error" :closable="false" class="mb-4">
      {{ teamsStore.error }}
    </Message>

    <div v-if="teamsStore.loading" class="spinner-wrap">
      <ProgressSpinner />
    </div>

    <div v-else-if="teamsStore.myTeams.length === 0" class="empty-state">
      <i class="pi pi-users empty-icon" />
      <p>You are not a member of any teams yet.</p>
      <p v-if="authStore.role === 'super_admin'" class="empty-hint">
        Create and assign teams in the
        <RouterLink to="/admin/teams" class="link">Admin Panel</RouterLink>.
      </p>
    </div>

    <div v-else class="teams-grid">
      <div
        v-for="team in teamsStore.myTeams"
        :key="team.id"
        class="team-card"
        @click="goToTeam(team.id)"
      >
        <div class="team-card__header">
          <i class="pi pi-users team-card__icon" />
          <span class="team-card__name">{{ team.name }}</span>
        </div>
        <div class="team-card__stats">
          <Tag :value="`${team.member_count} member${team.member_count === 1 ? '' : 's'}`" severity="secondary" />
          <Tag
            :value="`${team.project_count} project${team.project_count === 1 ? '' : 's'}`"
            :severity="team.project_count > 0 ? 'success' : 'secondary'"
          />
        </div>
        <div class="team-card__footer">
          <span class="team-card__date">Since {{ new Date(team.created_at).toLocaleDateString() }}</span>
          <i class="pi pi-chevron-right team-card__arrow" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.teams-list-view {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
}

.page-subtitle {
  margin: 0;
  color: var(--su-text-muted);
  font-size: 0.9rem;
}

.spinner-wrap {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--su-text-muted);
}

.empty-icon {
  font-size: 3rem;
  color: var(--su-border-glow);
  display: block;
  margin-bottom: 1rem;
}

.empty-hint {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.link {
  color: var(--su-purple-300);
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.team-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.team-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 16px 4px rgba(124, 58, 237, 0.35);
}

.team-card__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.team-card__icon {
  font-size: 1.1rem;
  color: var(--su-purple-400);
}

.team-card__name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--su-text);
}

.team-card__stats {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.team-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.team-card__date {
  font-size: 0.8rem;
  color: var(--su-text-muted);
}

.team-card__arrow {
  color: var(--su-text-muted);
  font-size: 0.8rem;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
