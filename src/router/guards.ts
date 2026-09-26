import type { RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * requireAuth — redirects unauthenticated users to /login.
 * Awaits auth initialization so guards work correctly on page refresh.
 */
export async function requireAuth(_to: RouteLocationNormalized, _from: RouteLocationNormalized) {
  const auth = useAuthStore()
  await auth.waitUntilReady()
  if (!auth.session) return { name: 'login' }
}

/**
 * requireRole — factory that returns a guard allowing only users with the
 * specified role(s). Redirects to /dashboard if authenticated but not
 * authorised; to /login if not authenticated at all.
 *
 * Usage in route definitions:
 *   beforeEnter: requireRole('super_admin')
 *   beforeEnter: requireRole(['super_admin', 'project_head'])
 */
export function requireRole(allowed: string | string[]) {
  const roles = Array.isArray(allowed) ? allowed : [allowed]

  return async function (_to: RouteLocationNormalized, _from: RouteLocationNormalized) {
    const auth = useAuthStore()
    await auth.waitUntilReady()

    if (!auth.session) return { name: 'login' }
    if (auth.role && roles.includes(auth.role)) return true
    // Authenticated but wrong role — bounce to dashboard
    return { name: 'dashboard' }
  }
}
