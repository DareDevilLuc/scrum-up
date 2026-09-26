import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { requireAuth, requireRole } from './guards'

const routes: RouteRecordRaw[] = [
  // ── Public ──────────────────────────────────────────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('../views/AuthCallbackView.vue'),
  },

  // ── Onboarding (auth required, no role restriction) ──────────────────────
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('../views/OnboardingView.vue'),
    beforeEnter: requireAuth,
  },

  // ── Protected ────────────────────────────────────────────────────────────
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    beforeEnter: requireRole('super_admin'),
    children: [
      {
        path: '',
        name: 'admin',
        redirect: { name: 'admin-users' },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('../views/admin/UsersView.vue'),
      },
      {
        path: 'teams',
        name: 'admin-teams',
        component: () => import('../views/admin/TeamsView.vue'),
      },
    ],
  },
  {
    path: '/projects/:id',
    name: 'project',
    component: () => import('../views/ProjectView.vue'),
    beforeEnter: requireAuth,
  },

  // ── Profiles ──────────────────────────────────────────────────────────────
  {
    path: '/profile',
    name: 'profile-own',
    component: () => import('../views/ProfileView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/:userId',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    beforeEnter: requireAuth,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
