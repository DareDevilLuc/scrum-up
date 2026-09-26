import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationsStore = defineStore('notifications', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const items = ref<AppNotification[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const unreadCount = computed(() => items.value.filter((n) => !n.is_read).length)

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Fetch all notifications for the current user, newest first. */
  async function fetchAll() {
    const auth = useAuthStore()
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, is_read, created_at')
        .eq('user_id', auth.user!.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (sbError) throw sbError
      items.value = data ?? []
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Mark a single notification as read. */
  async function markRead(notificationId: string) {
    const auth = useAuthStore()
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', auth.user!.id)

      const item = items.value.find((n) => n.id === notificationId)
      if (item) item.is_read = true
    } catch (e) {
      console.warn('[notifications] markRead failed:', (e as Error).message)
    }
  }

  /** Mark all notifications as read. */
  async function markAllRead() {
    const auth = useAuthStore()
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', auth.user!.id)
        .eq('is_read', false)

      for (const item of items.value) item.is_read = true
    } catch (e) {
      console.warn('[notifications] markAllRead failed:', (e as Error).message)
    }
  }

  function $reset() {
    items.value = []
    loading.value = false
    error.value = null
  }

  return { items, loading, error, unreadCount, fetchAll, markRead, markAllRead, $reset }
})
