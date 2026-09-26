<script setup lang="ts">
import { useRoute } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'

const route = useRoute()

const navItems = [
  { label: 'Users', icon: 'pi pi-users', to: '/admin/users' },
  { label: 'Teams', icon: 'pi pi-sitemap', to: '/admin/teams' },
]

function isActive(path: string) {
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <aside class="admin-sidebar">
      <div class="admin-sidebar__header">
        <i class="pi pi-shield" style="font-size: 1.25rem" />
        <span class="admin-sidebar__title">Admin Panel</span>
      </div>
      <nav class="admin-sidebar__nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="admin-nav-item"
          :class="{ 'admin-nav-item--active': isActive(item.to) }"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="admin-sidebar__footer">
        <RouterLink to="/dashboard" class="admin-nav-item">
          <i class="pi pi-arrow-left" />
          <span>Back to Dashboard</span>
        </RouterLink>
      </div>
    </aside>

    <!-- Main content -->
    <main class="admin-main">
      <RouterView />
    </main>
  </div>

  <!-- Shared toast/confirm providers for all admin child views -->
  <Toast />
  <ConfirmDialog />
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: var(--p-surface-ground, #f8fafc);
}

.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--p-surface-card, #ffffff);
  border-right: 1px solid var(--p-surface-border, #e2e8f0);
  display: flex;
  flex-direction: column;
}

.admin-sidebar__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.25rem 1rem;
  font-weight: 700;
  font-size: 1rem;
  border-bottom: 1px solid var(--p-surface-border, #e2e8f0);
}

.admin-sidebar__title {
  font-size: 0.95rem;
}

.admin-sidebar__nav {
  flex: 1;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-sidebar__footer {
  padding: 0.75rem 0.5rem;
  border-top: 1px solid var(--p-surface-border, #e2e8f0);
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  text-decoration: none;
  color: var(--p-text-color, #374151);
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}

.admin-nav-item:hover {
  background: var(--p-surface-hover, #f1f5f9);
}

.admin-nav-item--active {
  background: var(--p-primary-100, #e0e7ff);
  color: var(--p-primary-700, #4338ca);
  font-weight: 600;
}

.admin-main {
  flex: 1;
  padding: 2rem;
  overflow: auto;
}
</style>
