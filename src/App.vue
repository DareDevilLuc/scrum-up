<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
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
})
</script>

<template>
  <div>
    <header v-if="showNav" class="app-nav">
      <nav class="app-nav__links">
        <RouterLink to="/dashboard" class="nav-link">Dashboard</RouterLink>
        <RouterLink v-if="auth.role === 'super_admin'" to="/admin" class="nav-link nav-link--admin">
          <i class="pi pi-shield" style="font-size: 0.8rem" />
          Admin
        </RouterLink>
      </nav>
      <div class="app-nav__actions">
        <span class="nav-user">{{ auth.user?.user_metadata?.user_name ?? auth.user?.email }}</span>
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
.nav-user {
  font-size: 0.8rem;
  color: var(--su-text-muted);
}
</style>
