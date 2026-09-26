<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'
import { useInvitationsStore } from '@/stores/invitations'

const auth = useAuthStore()
const invitations = useInvitationsStore()
const route = useRoute()
const router = useRouter()
const ready = ref(false)

// Show nav on all protected routes (not on login/callback/onboarding)
const showNav = computed(() =>
  ready.value &&
  auth.session &&
  !['login', 'auth-callback', 'onboarding'].includes(route.name as string),
)

onMounted(async () => {
  await auth.initialize()
  ready.value = true
  // Load pending invitations once the user is authenticated
  if (auth.user) {
    invitations.fetchPending()
  }
})

// Re-fetch when auth user changes (e.g. sign-in after page reload)
watch(() => auth.user, (user) => {
  if (user) invitations.fetchPending()
  else invitations.$reset()
})
</script>

<template>
  <div>
    <header v-if="showNav" class="app-nav">
      <nav class="app-nav__links">
        <RouterLink to="/dashboard" class="nav-link">Dashboard</RouterLink>
        <RouterLink to="/projects" class="nav-link">Projects</RouterLink>
        <RouterLink to="/teams" class="nav-link">Teams</RouterLink>
        <RouterLink to="/inbox" class="nav-link nav-link--inbox">
          <i class="pi pi-inbox" style="font-size: 0.85rem" />
          Inbox
          <span v-if="invitations.pending.length > 0" class="inbox-badge">
            {{ invitations.pending.length }}
          </span>
        </RouterLink>
        <RouterLink v-if="auth.role === 'super_admin'" to="/admin" class="nav-link nav-link--admin">
          <i class="pi pi-shield" style="font-size: 0.8rem" />
          Admin
        </RouterLink>
      </nav>
      <div class="app-nav__actions">
        <button class="nav-profile-btn" @click="router.push('/profile')">
          <img
            v-if="auth.user?.user_metadata?.avatar_url"
            :src="auth.user.user_metadata.avatar_url"
            class="nav-avatar"
            alt="avatar"
          />
          <span v-else class="nav-avatar-placeholder">
            <i class="pi pi-user" />
          </span>
          <span class="nav-user">{{ auth.user?.user_metadata?.user_name ?? auth.user?.email }}</span>
        </button>
        <Button label="Sign out" text size="small" @click="auth.signOut()" />
      </div>
    </header>

    <RouterView v-if="ready" />
  </div>
</template>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 3.25rem;
  background: var(--su-bg-surface);
  border-bottom: 1px solid var(--su-border);
  box-shadow: 0 1px 0 var(--su-border), 0 2px 12px rgba(124, 58, 237, 0.12);
  position: sticky;
  top: 0;
  z-index: 100;
}
.app-nav__links {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}
.app-nav__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.nav-link {
  text-decoration: none;
  font-size: 0.875rem;
  color: var(--su-text-muted);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0;
  border-bottom: 2px solid transparent;
  transition: border-color 0.15s, color 0.15s, text-shadow 0.15s;
}
.nav-link:hover,
.nav-link.router-link-active {
  color: var(--su-purple-300);
  border-bottom-color: var(--su-purple-400);
}
.nav-link--admin {
  color: var(--su-purple-400);
}
.nav-link--admin:hover,
.nav-link--admin.router-link-active {
  color: var(--su-purple-300);
  border-bottom-color: var(--su-border-glow);
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.7);
}
.nav-link--inbox {
  position: relative;
}
.inbox-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background: var(--su-danger);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  border-radius: 999px;
  padding: 0.05rem 0.35rem;
  line-height: 1.4;
  pointer-events: none;
}
.nav-profile-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  transition: background 0.15s;
}
.nav-profile-btn:hover {
  background: rgba(124, 58, 237, 0.12);
}
.nav-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 1px solid var(--su-border-glow);
  object-fit: cover;
}
.nav-avatar-placeholder {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--su-purple-400);
}
.nav-user {
  font-size: 0.8rem;
  color: var(--su-text-muted);
  transition: color 0.15s;
}
.nav-profile-btn:hover .nav-user {
  color: var(--su-purple-300);
}
</style>
