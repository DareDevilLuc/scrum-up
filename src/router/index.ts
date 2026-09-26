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
    path: '/teams',
    name: 'teams',
    component: () => import('../views/teams/TeamsListView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/teams/:id',
    name: 'team-detail',
    component: () => import('../views/teams/TeamDetailView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('../views/projects/ProjectsListView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/projects/new',
    name: 'project-new',
    component: () => import('../views/projects/CreateProjectView.vue'),
    beforeEnter: requireRole(['project_head', 'super_admin']),
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('../views/projects/ProjectDashboardView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/projects/:id/sprints/:sprintId',
    name: 'kanban',
    component: () => import('../views/projects/KanbanView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/projects/:id/sprints/:sprintId/review',
    name: 'sprint-review',
    component: () => import('../views/projects/SprintReviewView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/projects/:id/sprints/:sprintId/retro',
    name: 'sprint-retro',
    component: () => import('../views/projects/SprintRetroView.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/projects/:id/plan-sprint',
    name: 'sprint-planner',
    component: () => import('../views/projects/SprintPlannerView.vue'),
    beforeEnter: requireRole(['project_head', 'super_admin']),
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
