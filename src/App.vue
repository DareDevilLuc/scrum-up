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
  height: 3rem;
  background: var(--p-surface-card, #fff);
  border-bottom: 1px solid var(--p-surface-border, #e2e8f0);
  position: sticky;
  top: 0;
  z-index: 100;
}
.app-nav__links {
  display: flex;
  gap: 1.25rem;
  align-items: center;
}
.app-nav__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.nav-link {
  text-decoration: none;
  font-size: 0.9rem;
  color: var(--p-text-color, #374151);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0;
  border-bottom: 2px solid transparent;
  transition: border-color 0.15s, color 0.15s;
}
.nav-link:hover,
.nav-link.router-link-active {
  color: var(--p-primary-color, #6366f1);
  border-bottom-color: var(--p-primary-color, #6366f1);
}
.nav-link--admin {
  color: var(--p-red-600, #dc2626);
}
.nav-link--admin:hover,
.nav-link--admin.router-link-active {
  color: var(--p-red-700, #b91c1c);
  border-bottom-color: var(--p-red-600, #dc2626);
}
.nav-user {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #6b7280);
}
</style>
