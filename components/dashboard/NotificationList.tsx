'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, RefreshCw, CheckCheck, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Database, NotificationType } from '@/lib/types/database'

// =============================================================================
// Types
// =============================================================================

type NotificationRow = Database['public']['Tables']['notifications']['Row']

export interface NotificationListProps {
  initialNotifications: NotificationRow[]
  initialTotal: number
}

// =============================================================================
// Constants
// =============================================================================

const PAGE_SIZE = 20

const TYPE_LABELS: Record<NotificationType, string> = {
  benefit_reminder: 'สิทธิประโยชน์',
  payment_status: 'สถานะเงิน',
  section40_outreach: 'มาตรา 40',
  system: 'ระบบ',
}

const TYPE_ICONS: Record<NotificationType, string> = {
  benefit_reminder: '🔔',
  payment_status: '💰',
  section40_outreach: '📢',
  system: 'ℹ️',
}

const TYPE_COLORS: Record<NotificationType, string> = {
  benefit_reminder: 'bg-orange-50 border-orange-200 text-orange-700',
  payment_status: 'bg-green-50 border-green-200 text-green-700',
  section40_outreach: 'bg-purple-50 border-purple-200 text-purple-700',
  system: 'bg-gray-50 border-gray-200 text-gray-700',
}

// =============================================================================
// Helpers
// =============================================================================

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'เมื่อกี้'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} วันที่แล้ว`
  return new Intl.DateTimeFormat('th-TH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    calendar: 'buddhist',
  }).format(new Date(dateStr))
}

// =============================================================================
// Sub-components
// =============================================================================

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: NotificationRow
  onMarkRead: (id: string) => void
}) {
  const { id, type, title, body, read, sent_at } = notification

  return (
    <div
      role="article"
      aria-label={title}
      className={[
        'relative flex gap-3 px-4 py-4 border-b last:border-b-0 transition-colors',
        !read ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-gray-50/70',
      ].join(' ')}
    >
      {/* Unread dot */}
      {!read && (
        <span
          aria-hidden
          className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500"
        />
      )}

      {/* Icon */}
      <div className="shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg leading-none mt-0.5">
        {TYPE_ICONS[type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Type badge + time */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${TYPE_COLORS[type]}`}
          >
            {TYPE_LABELS[type]}
          </span>
          <time className="text-xs text-gray-400" dateTime={sent_at}>
            {timeAgo(sent_at)}
          </time>
        </div>

        {/* Title */}
        <p className={`text-sm leading-snug ${!read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
          {title}
        </p>

        {/* Body */}
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{body}</p>
      </div>

      {/* Mark as read button */}
      {!read && (
        <button
          onClick={() => onMarkRead(id)}
          className="shrink-0 self-start mt-1 text-xs text-blue-500 hover:text-blue-700 transition-colors whitespace-nowrap"
          aria-label="อ่านแล้ว"
        >
          อ่านแล้ว
        </button>
      )}
    </div>
  )
}

function EmptyState({ typeFilter }: { typeFilter: NotificationType | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Bell className="w-8 h-8 text-gray-300" />
      </div>
      <p className="text-gray-500 font-medium">ไม่มีการแจ้งเตือน</p>
      {typeFilter && (
        <p className="text-sm text-gray-400 mt-1">
          ลองเปลี่ยน filter หรือดูการแจ้งเตือนทั้งหมด
        </p>
      )}
    </div>
  )
}

// =============================================================================
// Main component
// =============================================================================

export function NotificationList({
  initialNotifications,
  initialTotal,
}: NotificationListProps) {
  const [items, setItems] = useState<NotificationRow[]>(initialNotifications)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(initialTotal > PAGE_SIZE)

  // Filter state
  const [typeFilter, setTypeFilter] = useState<NotificationType | null>(null)
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')

  // Track if filters changed (need to reset list)
  const filterRef = useRef({ typeFilter, readFilter })

  const unreadCount = items.filter((n) => !n.read).length

  // ==========================================================================
  // Supabase Realtime — live new notifications
  // ==========================================================================

  useEffect(() => {
    const supabase = createClient()
    let userId: string | null = null

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
      if (!userId) return

      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `member_id=eq.${userId}`,
          },
          (payload) => {
            const newNotif = payload.new as NotificationRow
            // Prepend to list only if matches current filters
            const matchesType = !typeFilter || newNotif.type === typeFilter
            const matchesRead =
              readFilter === 'all' ||
              (readFilter === 'unread' && !newNotif.read) ||
              (readFilter === 'read' && newNotif.read)

            if (matchesType && matchesRead) {
              setItems((prev) => [newNotif, ...prev])
              setTotal((t) => t + 1)
            }
          },
        )
        .subscribe()

      return channel
    }

    let channelRef: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    setup().then((ch) => {
      channelRef = ch ?? null
    })

    return () => {
      if (channelRef) {
        const supabase = createClient()
        supabase.removeChannel(channelRef)
      }
    }
  }, [typeFilter, readFilter])

  // ==========================================================================
  // Fetch with current filters (reset on filter change)
  // ==========================================================================

  const fetchNotifications = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      const targetPage = opts.reset ? 1 : page + 1
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_SIZE),
        })
        if (typeFilter) params.set('type', typeFilter)
        if (readFilter !== 'all') params.set('read', readFilter === 'read' ? 'true' : 'false')

        const res = await fetch(`/api/notifications?${params}`)
        if (!res.ok) throw new Error('Fetch failed')
        const data = await res.json()

        if (opts.reset) {
          setItems(data.notifications)
          setPage(1)
        } else {
          setItems((prev) => [...prev, ...data.notifications])
          setPage(targetPage)
        }
        setTotal(data.total)
        setHasMore(data.hasMore)
      } catch (err) {
        console.error('[NotificationList] fetch error', err)
      } finally {
        setIsLoading(false)
      }
    },
    [page, typeFilter, readFilter],
  )

  // Reset when filters change
  useEffect(() => {
    const prev = filterRef.current
    if (prev.typeFilter !== typeFilter || prev.readFilter !== readFilter) {
      filterRef.current = { typeFilter, readFilter }
      fetchNotifications({ reset: true })
    }
  }, [typeFilter, readFilter, fetchNotifications])

  // ==========================================================================
  // Actions
  // ==========================================================================

  const markAsRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n,
      ),
    )
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return
    setItems((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() })),
    )
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }, [unreadCount])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await fetchNotifications({ reset: true })
    setIsRefreshing(false)
  }, [fetchNotifications])

  // ==========================================================================
  // Filter helpers
  // ==========================================================================

  const typeOptions: NotificationType[] = [
    'benefit_reminder',
    'payment_status',
    'section40_outreach',
    'system',
  ]

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">การแจ้งเตือน</span>
            {total > 0 && (
              <Badge variant="secondary" className="text-xs">
                {total.toLocaleString('th-TH')}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="รีเฟรช"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>

            {/* Mark all read */}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 h-8 px-2 gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                อ่านทั้งหมด ({unreadCount})
              </Button>
            )}
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide flex-nowrap">
          {/* Read/Unread toggle */}
          <button
            onClick={() => setReadFilter('all')}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              readFilter === 'all'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setReadFilter('unread')}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              readFilter === 'unread'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            ยังไม่อ่าน
          </button>
          <button
            onClick={() => setReadFilter('read')}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              readFilter === 'read'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            อ่านแล้ว
          </button>

          {/* Separator */}
          <span className="shrink-0 w-px bg-gray-200 mx-1 self-stretch" />

          {/* Type filters */}
          {typeOptions.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === t
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{TYPE_ICONS[t]}</span>
              <span>{TYPE_LABELS[t]}</span>
              {typeFilter === t && <X className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Active filter summary ───────────────────────────────────── */}
      {(typeFilter || readFilter !== 'all') && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-xs text-blue-700 border-b">
          <Filter className="w-3.5 h-3.5 shrink-0" />
          <span>
            กำลังแสดง:{' '}
            {[
              readFilter !== 'all' ? (readFilter === 'unread' ? 'ยังไม่อ่าน' : 'อ่านแล้ว') : null,
              typeFilter ? TYPE_LABELS[typeFilter] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <button
            onClick={() => {
              setTypeFilter(null)
              setReadFilter('all')
            }}
            className="ml-auto text-blue-600 hover:text-blue-800 underline"
          >
            ล้าง
          </button>
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="bg-white border-x border-b rounded-b-lg overflow-hidden">
        {items.length === 0 && !isLoading ? (
          <EmptyState typeFilter={typeFilter} />
        ) : (
          <>
            {items.map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkRead={markAsRead} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="p-4 flex justify-center border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNotifications()}
                  disabled={isLoading}
                  className="text-sm"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      กำลังโหลด…
                    </span>
                  ) : (
                    `โหลดเพิ่มเติม (${total - items.length} รายการ)`
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Loading skeleton for initial load */}
        {isLoading && items.length === 0 && (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
