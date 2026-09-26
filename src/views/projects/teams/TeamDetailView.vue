<script setup lang="ts">
import { onMounted } from 'vue'
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
const teamsStore = useTeamsStore()
const authStore = useAuthStore()

const teamId = route.params.id as string

onMounted(async () => {
  await Promise.all([
    teamsStore.fetchTeamDetail(teamId),
    teamsStore.fetchTeamMembers(teamId),
  ])
})

function getInitials(name: string | null, username: string | null): string {
  const source = name ?? username ?? '?'
  return source.slice(0, 2).toUpperCase()
}

function goToProfile(userId: string) {
  // /profile/:userId — created in Sub-Task 5
  router.push(`/profile/${userId}`)
}
</script>

<template>
  <div class="team-detail-view">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <Button
          icon="pi pi-arrow-left"
          text
          size="small"
          class="back-btn"
          @click="router.push({ name: 'teams' })"
        />
        <div>
          <h1 class="page-title">
            <span v-if="teamsStore.currentTeam">{{ teamsStore.currentTeam.name }}</span>
            <span v-else class="skeleton-title" />
          </h1>
          <p class="page-subtitle">Team members and their skills</p>
        </div>
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

    <!-- Members list -->
    <div v-else-if="teamsStore.currentMembers.length === 0" class="empty-state">
      <i class="pi pi-user empty-icon" />
      <p>No members in this team yet.</p>
    </div>

    <div v-else class="members-list">
      <div
        v-for="member in teamsStore.currentMembers"
        :key="member.user_id"
        class="member-card"
      >
        <div class="member-card__left">
          <Avatar
            v-if="member.avatar_url"
            :image="member.avatar_url"
            shape="circle"
            size="large"
            class="member-avatar"
          />
          <Avatar
            v-else
            :label="getInitials(member.display_name, member.github_username)"
            shape="circle"
            size="large"
            class="member-avatar"
          />
          <div class="member-info">
            <span class="member-name">
              {{ member.display_name ?? member.github_username ?? 'Unknown' }}
            </span>
            <span v-if="member.github_username" class="member-github">
              <i class="pi pi-github" />
              {{ member.github_username }}
            </span>
          </div>
        </div>

        <div class="member-card__skills">
          <Tag
            v-for="skill in (member.tech_stack ?? []).slice(0, 5)"
            :key="skill"
            :value="skill"
            severity="secondary"
            class="skill-tag"
          />
          <span
            v-if="(member.tech_stack ?? []).length > 5"
            class="skills-overflow"
          >
            +{{ (member.tech_stack ?? []).length - 5 }} more
          </span>
        </div>

        <div class="member-card__actions">
          <Button
            label="View Profile"
            icon="pi pi-user"
            text
            size="small"
            @click="goToProfile(member.user_id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.team-detail-view {
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

.page-header__left {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.back-btn {
  margin-top: 0.25rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
}

.skeleton-title {
  display: inline-block;
  width: 180px;
  height: 1.75rem;
  background: var(--su-bg-elevated);
  border-radius: 6px;
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

.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.1);
  transition: box-shadow 0.2s, border-color 0.2s;
}

.member-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 14px 3px rgba(124, 58, 237, 0.25);
}

.member-card__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 200px;
}

.member-avatar {
  flex-shrink: 0;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.member-name {
  font-weight: 600;
  color: var(--su-text);
  font-size: 0.95rem;
}

.member-github {
  font-size: 0.8rem;
  color: var(--su-text-muted);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.member-card__skills {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.skill-tag {
  font-size: 0.75rem;
}

.skills-overflow {
  font-size: 0.75rem;
  color: var(--su-text-muted);
}

.member-card__actions {
  flex-shrink: 0;
  margin-left: auto;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
