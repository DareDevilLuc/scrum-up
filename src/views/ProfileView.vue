<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Chips from 'primevue/chips'
import Message from 'primevue/message'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const route = useRoute()
const auth = useAuthStore()
const profileStore = useProfileStore()

// The userId being viewed: use route param if present, else own user id
const userId = computed(() => (route.params.userId as string | undefined) ?? auth.user?.id ?? '')
const isOwnProfile = computed(() => userId.value === auth.user?.id)

// Local editable state
const editTechStack = ref<string[]>([])
const editExperienceYears = ref<number | null>(null)
const editPortfolioUrl = ref('')
const saving = ref(false)
const saveSuccess = ref(false)

onMounted(() => loadProfile())
watch(userId, loadProfile)

async function loadProfile() {
  if (!userId.value) return
  await profileStore.fetchProfile(userId.value)
  resetEditState()
}

function resetEditState() {
  const p = profileStore.profile
  editTechStack.value = [...(p?.tech_stack ?? [])]
  editExperienceYears.value = p?.experience_years ?? null
  editPortfolioUrl.value = p?.portfolio_url ?? ''
}

async function handleSave() {
  if (!userId.value) return
  saving.value = true
  saveSuccess.value = false
  const ok = await profileStore.updateProfile(userId.value, {
    tech_stack: editTechStack.value,
    experience_years: editExperienceYears.value,
    portfolio_url: editPortfolioUrl.value || null,
  })
  saving.value = false
  if (ok) saveSuccess.value = true
}

async function handleSync() {
  if (!userId.value) return
  await profileStore.syncFromGitHub(userId.value)
  resetEditState()
}

// Build chart data from languages map
const chartData = computed(() => {
  const langs = profileStore.profile?.languages
  if (!langs || Object.keys(langs).length === 0) return null

  const sorted = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const total = sorted.reduce((s, [, v]) => s + v, 0)

  return {
    labels: sorted.map(([l]) => l),
    datasets: [
      {
        label: '%',
        data: sorted.map(([, v]) => Math.round((v / total) * 100)),
        backgroundColor: '#7c3aed',
        hoverBackgroundColor: '#a855f7',
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: {
    label: (ctx: { parsed: { y: number | null } }) => ` ${ctx.parsed.y ?? 0}%`,
  }}},
  scales: {
    x: { ticks: { color: '#8b7aab' }, grid: { color: 'rgba(42,26,78,0.5)' } },
    y: { ticks: { color: '#8b7aab', callback: (v: number | string) => `${v}%` }, grid: { color: 'rgba(42,26,78,0.5)' }, max: 100 },
  },
}
</script>

<template>
  <div class="profile-page">
    <!-- Loading -->
    <div v-if="profileStore.loading" class="state-message">
      <i class="pi pi-spin pi-spinner" />
      <span>Loading profile…</span>
    </div>

    <!-- Error -->
    <Message v-else-if="profileStore.error" severity="error" :closable="false">
      {{ profileStore.error }}
    </Message>

    <!-- No profile yet (edge case: user never synced) -->
    <div v-else-if="!profileStore.profile" class="state-message">
      <p>No developer profile found.</p>
      <Button
        v-if="isOwnProfile"
        label="Sync from GitHub"
        icon="pi pi-github"
        :loading="profileStore.syncing"
        @click="handleSync"
      />
    </div>

    <!-- Profile content -->
    <template v-else>
      <!-- Header card -->
      <div class="profile-header-card">
        <img
          v-if="profileStore.profile.avatar_url"
          :src="profileStore.profile.avatar_url"
          class="profile-avatar"
          alt="avatar"
        />
        <div v-else class="profile-avatar-placeholder">
          <i class="pi pi-user" />
        </div>
        <div class="profile-header-info">
          <h1 class="profile-name">{{ profileStore.profile.display_name ?? 'Developer' }}</h1>
          <a
            v-if="profileStore.profile.github_username"
            :href="`https://github.com/${profileStore.profile.github_username}`"
            target="_blank"
            class="github-link"
          >
            <i class="pi pi-github" />
            {{ profileStore.profile.github_username }}
          </a>
          <p v-if="profileStore.profile.bio" class="profile-bio">
            {{ profileStore.profile.bio }}
          </p>
        </div>
        <div v-if="isOwnProfile" class="profile-header-actions">
          <Button
            label="Sync from GitHub"
            icon="pi pi-refresh"
            size="small"
            outlined
            :loading="profileStore.syncing"
            @click="handleSync"
          />
        </div>
      </div>

      <div class="profile-grid">
        <!-- Language breakdown -->
        <div class="profile-card" v-if="chartData">
          <h2 class="card-title">Language Breakdown</h2>
          <div class="chart-wrapper">
            <Bar :data="chartData" :options="chartOptions" />
          </div>
        </div>

        <!-- Top GitHub Repos -->
        <div class="profile-card" v-if="profileStore.profile.github_repos?.length">
          <h2 class="card-title">Top Repositories</h2>
          <div class="repo-list">
          <a  
              v-for="repo in profileStore.profile.github_repos"
              :key="repo.full_name"
              :href="repo.url"
              target="_blank"
              class="repo-item"
            >
              <div class="repo-main">
                <span class="repo-name">{{ repo.name }}</span>
                <span v-if="repo.language" class="repo-lang">{{ repo.language }}</span>
              </div>
              <p v-if="repo.description" class="repo-desc">{{ repo.description }}</p>
              <span class="repo-stars">
                <i class="pi pi-star" /> {{ repo.stars }}
              </span>
            </a>
          </div>
        </div>

        <!-- Editable fields -->
        <div class="profile-card profile-card--edit" :class="{ 'readonly': !isOwnProfile }">
          <h2 class="card-title">Profile Details</h2>

          <Message v-if="saveSuccess" severity="success" :closable="false" class="save-msg">
            Profile saved.
          </Message>

          <div class="form-field">
            <label class="field-label">Tech Stack</label>
            <Chips
              v-model="editTechStack"
              placeholder="Add a technology…"
              :disabled="!isOwnProfile"
              class="chips-input"
            />
          </div>

          <div class="form-row">
            <div class="form-field">
              <label class="field-label">Years of Experience</label>
              <InputNumber
                v-model="editExperienceYears"
                :min="0"
                :max="50"
                placeholder="e.g. 3"
                :disabled="!isOwnProfile"
                class="w-full"
              />
            </div>
            <div class="form-field">
              <label class="field-label">Portfolio URL</label>
              <InputText
                v-model="editPortfolioUrl"
                placeholder="https://yoursite.dev"
                :disabled="!isOwnProfile"
                class="w-full"
              />
            </div>
          </div>

          <Button
            v-if="isOwnProfile"
            label="Save Changes"
            icon="pi pi-check"
            :loading="saving"
            class="save-btn"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

/* ── Loading / empty states ── */
.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  color: var(--su-text-muted);
  font-size: 1rem;
}

.state-message i {
  font-size: 1.5rem;
  color: var(--su-purple-400);
}

/* ── Header card ── */
.profile-header-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 14px;
  padding: 2rem;
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.15);
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid var(--su-border-glow);
  box-shadow: 0 0 12px 3px rgba(124, 58, 237, 0.4);
  flex-shrink: 0;
  object-fit: cover;
}

.profile-avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--su-bg-elevated);
  border: 2px solid var(--su-border-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--su-purple-400);
  flex-shrink: 0;
}

.profile-header-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.profile-name {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.7);
  letter-spacing: -0.02em;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--su-text-muted);
  font-size: 0.85rem;
  text-decoration: none;
  transition: color 0.15s;
}

.github-link:hover {
  color: var(--su-purple-300);
}

.profile-bio {
  margin: 0.25rem 0 0;
  color: var(--su-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.profile-header-actions {
  flex-shrink: 0;
}

/* ── Grid layout ── */
.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.25rem;
}

@media (max-width: 700px) {
  .profile-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ── Cards ── */
.profile-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.12);
  min-width: 0;
  box-sizing: border-box;
}

.profile-card--edit {
  grid-column: 1 / -1;
}

.card-title {
  margin: 0 0 1.25rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--su-purple-300);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Chart ── */
.chart-wrapper {
  height: 200px;
  width: 100%;
  overflow: hidden;
  position: relative;
}

/* ── Repos ── */
.repo-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 340px;
  overflow-y: auto;
}

.repo-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  text-decoration: none;
  color: var(--su-text);
  transition: border-color 0.15s, box-shadow 0.15s;
  min-width: 0;
}

.repo-item:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 8px 1px rgba(124, 58, 237, 0.3);
}

.repo-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.repo-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--su-purple-300);
}

.repo-lang {
  font-size: 0.7rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.4);
}

.repo-desc {
  margin: 0;
  font-size: 0.78rem;
  color: var(--su-text-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-stars {
  font-size: 0.75rem;
  color: var(--su-text-muted);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.repo-stars i {
  color: var(--su-warning);
  font-size: 0.7rem;
}

/* ── Editable fields ── */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
  min-width: 0;
}

.form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

@media (max-width: 500px) {
  .form-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--su-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.save-msg {
  margin-bottom: 1rem;
}

.save-btn {
  margin-top: 0.25rem;
}

.chips-input {
  width: 100%;
}

/* PrimeVue overrides */
:deep(.p-inputtext),
:deep(.p-inputnumber-input) {
  background: var(--su-bg-elevated);
  border-color: var(--su-border);
  color: var(--su-text);
}

:deep(.p-inputtext:focus),
:deep(.p-inputnumber-input:focus) {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

:deep(.p-chips .p-chips-multiple-container) {
  background: var(--su-bg-elevated);
  border-color: var(--su-border);
  gap: 0.4rem;
}

:deep(.p-chips .p-chips-multiple-container:not(.p-disabled).p-focus) {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

:deep(.p-chips .p-chips-token) {
  background: rgba(124, 58, 237, 0.25);
  color: var(--su-purple-300);
  border: 1px solid rgba(124, 58, 237, 0.5);
  border-radius: 999px;
}

:deep(.p-chips .p-chips-input-token input) {
  color: var(--su-text);
}

:deep(.p-button) {
  background: linear-gradient(135deg, #4c1d95, #7c3aed);
  border-color: #7c3aed;
  color: #e9d5ff;
  box-shadow: 0 0 8px 1px rgba(124, 58, 237, 0.4);
}

:deep(.p-button:hover) {
  background: linear-gradient(135deg, #5b21b6, #a855f7);
  border-color: #a855f7;
  box-shadow: 0 0 14px 3px rgba(168, 85, 247, 0.55);
}

:deep(.p-button.p-button-outlined) {
  background: transparent;
  color: var(--su-purple-300);
}

:deep(.p-button.p-button-outlined:hover) {
  background: rgba(124, 58, 237, 0.12);
}
</style>