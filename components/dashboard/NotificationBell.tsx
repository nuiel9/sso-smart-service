'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'

// =============================================================================
// Types
// =============================================================================

type NotificationRow = Database['public']['Tables']['notifications']['Row']

export interface NotificationBellProps {
  /** Notifications ที่ fetch มาจาก Server Component (top 5) */
  initialNotifications: NotificationRow[]
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
    calendar: 'buddhist',
  }).format(new Date(dateStr))
}

const NOTIFICATION_ICONS: Record<NotificationRow['type'], string> = {
  benefit_reminder: '🔔',
  payment_status: '💰',
  section40_outreach: '📢',
  system: 'ℹ️',
}

// =============================================================================
// Component
// =============================================================================

export function NotificationBell({ initialNotifications }: NotificationBellProps) {
  const [items, setItems] = useState<NotificationRow[]>(initialNotifications)
  const unreadCount = items.filter((n) => !n.read).length

  // ---------- Mark single notification as read ----------
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update (instant UI feedback)
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
      )
    )
    // Persist to DB
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  // ---------- Mark all as read ----------
  const markAllAsRead = useCallback(async () => {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    setItems((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
    )
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds)
  }, [items])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/10 focus-visible:ring-white"
          aria-label={
            unreadCount > 0
              ? `การแจ้งเตือน ${unreadCount} รายการใหม่`
              : 'การแจ้งเตือน'
          }
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <span className="font-semibold text-sm text-gray-900">การแจ้งเตือน</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              อ่านทั้งหมด
            </button>
          )}
        </div>

        {/* Notification list */}
        {items.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-10 h-10 mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">ไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={[
                'flex flex-col items-start gap-1 px-4 py-3 cursor-pointer',
                'focus:bg-blue-50',
                !n.read ? 'bg-blue-50/40' : '',
              ].join(' ')}
              onClick={() => {
                if (!n.read) markAsRead(n.id)
              }}
            >
              {/* Row 1: icon + title + unread dot */}
              <div className="flex items-center gap-2 w-full">
                <span className="text-base leading-none" aria-hidden>
                  {NOTIFICATION_ICONS[n.type]}
                </span>
                <span
                  className={`text-sm flex-1 leading-snug ${
                    !n.read ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'
                  }`}
                >
                  {n.title}
                </span>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden />
                )}
              </div>

              {/* Row 2: body */}
              <p className="text-xs text-gray-500 ml-6 leading-relaxed line-clamp-2">
                {n.body}
              </p>

              {/* Row 3: time */}
              <time
                className="text-xs text-gray-400 ml-6"
                dateTime={n.sent_at}
              >
                {timeAgo(n.sent_at)}
              </time>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator className="my-0" />

        {/* Footer link */}
        <DropdownMenuItem asChild className="px-4 py-3 justify-center">
          <Link
            href="/member/notifications"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium text-center w-full"
          >
            ดูการแจ้งเตือนทั้งหมด →
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

