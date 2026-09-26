<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useTeamsStore } from '@/stores/teams'
import type { TeamMemberProfile } from '@/stores/teams'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const teams = useTeamsStore()
const auth = useAuthStore()

const teamId = computed(() => route.params.id as string)

onMounted(async () => {
  await teams.fetchTeamDetail(teamId.value)
  await Promise.all([
    teams.fetchTeamMembers(teamId.value),
    teams.fetchTeamProjects(teamId.value),
  ])
})

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

// Group members by role for display
const superAdmins = computed(() =>
  teams.currentMembers.filter((m) => m.role === 'super_admin'),
)
const projectHeads = computed(() =>
  teams.currentMembers.filter((m) => m.role === 'project_head'),
)
const developers = computed(() =>
  teams.currentMembers.filter((m) => m.role === 'developer' || m.role === null),
)

interface RoleGroup {
  label: string
  icon: string
  members: TeamMemberProfile[]
  tagClass: string
  tagLabel: string
}

const roleGroups = computed<RoleGroup[]>(() =>
  [
    { label: 'Super Admins', icon: 'pi pi-shield', members: superAdmins.value, tagClass: 'tag--admin', tagLabel: 'Super Admin' },
    { label: 'Project Heads', icon: 'pi pi-star', members: projectHeads.value, tagClass: 'tag--head', tagLabel: 'Project Head' },
    { label: 'Developers', icon: 'pi pi-code', members: developers.value, tagClass: 'tag--dev', tagLabel: 'Developer' },
  ].filter((g) => g.members.length > 0),
)
// Build a map: user_id → display_name (for showing project head name)
const memberNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const m of teams.currentMembers) {
    map[m.user_id] = m.display_name ?? m.github_username ?? 'Unknown'
  }
  return map
})

function statusClass(status: string): string {
  if (status === 'active') return 'status--active'
  if (status === 'completed') return 'status--done'
  if (status === 'on_hold') return 'status--hold'
  return 'status--planning'
}

function statusLabel(status: string): string {
  return status.replace('_', ' ')
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

    <!-- Members grouped by role -->
    <template v-else>
      <div v-for="group in roleGroups" :key="group.label" class="role-section">
        <!-- Role group header -->
        <div class="role-header">
          <i :class="group.icon" class="role-icon" />
          <span class="role-label">{{ group.label }}</span>
          <span class="role-count">{{ group.members.length }}</span>
        </div>

        <!-- Members grid -->
        <div class="members-grid">
          <div
            v-for="member in group.members"
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
              <!-- Role badge -->
              <span class="role-badge" :class="group.tagClass">{{ group.tagLabel }}</span>
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

    <!-- Projects panel -->
    <div v-if="teams.currentTeamProjects.length > 0" class="projects-section">
      <div class="role-header">
        <i class="pi pi-folder role-icon" />
        <span class="role-label">Projects</span>
        <span class="role-count">{{ teams.currentTeamProjects.length }}</span>
      </div>
      <div class="projects-grid">
        <div
          v-for="proj in teams.currentTeamProjects"
          :key="proj.id"
          class="project-card"
          @click="router.push({ name: 'project-detail', params: { id: proj.id } })"
        >
          <div class="project-card-header">
            <span class="project-name">{{ proj.name }}</span>
            <span class="project-status" :class="statusClass(proj.status)">
              {{ statusLabel(proj.status) }}
            </span>
          </div>
          <div class="project-meta">
            <span v-if="proj.created_by" class="project-head-chip">
              <i class="pi pi-star" />
              {{ memberNameMap[proj.created_by] ?? 'Unknown' }}
            </span>
            <span v-if="proj.start_date" class="meta-chip">
              <i class="pi pi-calendar" />
              {{ new Date(proj.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) }}
            </span>
          </div>
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

/* ── Role sections ─────────────────────────────────────────────────────────── */

.role-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.role-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--su-border);
}

.role-icon {
  font-size: 0.85rem;
  color: var(--su-purple-400);
}

.role-label {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-purple-300);
}

.role-count {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
}

/* ── Role badge on card ────────────────────────────────────────────────────── */

.role-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}

.tag--admin {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.tag--head {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.35);
}

.tag--dev {
  background: rgba(124, 58, 237, 0.15);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.35);
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

/* ── Projects section ───────────────────────────────────────────────────────── */

.projects-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}

.project-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  padding: 0.9rem 1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 10px 2px rgba(124, 58, 237, 0.08);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.project-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 14px 4px rgba(124, 58, 237, 0.3);
}

.project-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.project-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--su-text);
}

.project-status {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}

.status--active  { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
.status--done    { background: rgba(124, 58, 237, 0.15); color: var(--su-purple-300); border: 1px solid rgba(124, 58, 237, 0.3); }
.status--hold    { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
.status--planning { background: rgba(139, 122, 171, 0.15); color: var(--su-text-muted); border: 1px solid rgba(139, 122, 171, 0.3); }

.project-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.meta-chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--su-text-muted);
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.15);
  border-radius: 999px;
  padding: 0.12rem 0.5rem;
}

.project-head-chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: 999px;
  padding: 0.12rem 0.5rem;
}
</style>
