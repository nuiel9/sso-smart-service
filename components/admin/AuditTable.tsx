'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import {
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// =============================================================================
// Types
// =============================================================================

interface AuditLogRow {
  id: string
  action: string
  resource: string
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
  profiles: { full_name_th: string | null; role: string } | null
}

interface Filters {
  from: string
  to: string
  userId: string
  action: string
}

interface AuditTableProps {
  logs: AuditLogRow[]
  total: number
  page: number
  totalPages: number
  pageSize: number
  filters: Filters
  distinctActions: string[]
}

// =============================================================================
// Action color mapping
// =============================================================================

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-green-100 text-green-800',
  logout: 'bg-gray-100 text-gray-700',
  register: 'bg-blue-100 text-blue-800',
  view_profile: 'bg-purple-100 text-purple-800',
  update_profile: 'bg-yellow-100 text-yellow-800',
  data_export: 'bg-orange-100 text-orange-800',
  pdpa_consent_granted: 'bg-teal-100 text-teal-800',
  pdpa_consent_revoked: 'bg-red-100 text-red-800',
  view_benefits: 'bg-indigo-100 text-indigo-800',
  chat_message_sent: 'bg-blue-100 text-blue-700',
  admin_view_user: 'bg-rose-100 text-rose-800',
  admin_send_notification: 'bg-pink-100 text-pink-800',
  cron_predict_notifications: 'bg-gray-100 text-gray-600',
}

function actionBadgeClass(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600'
}

// =============================================================================
// Helpers
// =============================================================================

function formatTs(ts: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    calendar: 'buddhist',
    hour12: false,
  }).format(new Date(ts))
}

function metaPreview(metadata: Record<string, unknown>): string {
  const keys = Object.keys(metadata)
  if (keys.length === 0) return '—'
  const preview = keys
    .slice(0, 3)
    .map((k) => {
      const val = metadata[k]
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
      return `${k}: ${str.length > 20 ? str.slice(0, 20) + '…' : str}`
    })
    .join(' · ')
  return keys.length > 3 ? preview + ` +${keys.length - 3}` : preview
}

// =============================================================================
// CSV export (client-side)
// =============================================================================

function exportToCsv(logs: AuditLogRow[]) {
  const headers = [
    'timestamp',
    'user',
    'role',
    'action',
    'resource',
    'ip_address',
    'metadata',
  ]

  const rows = logs.map((log) => [
    log.created_at,
    log.profiles?.full_name_th ?? '(system)',
    log.profiles?.role ?? '—',
    log.action,
    log.resource,
    log.ip_address ?? '',
    JSON.stringify(log.metadata),
  ])

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '')
          return s.includes(',') || s.includes('\n') || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s
        })
        .join(','),
    )
    .join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// =============================================================================
// Main component
// =============================================================================

export function AuditTable({
  logs,
  total,
  page,
  totalPages,
  pageSize,
  filters,
  distinctActions,
}: AuditTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const formRef = useRef<HTMLFormElement>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Build URL for navigation
  const buildUrl = useCallback(
    (overrides: Partial<Filters & { page: number }>) => {
      const p = new URLSearchParams()
      const merged = { ...filters, page, ...overrides }
      if (merged.from) p.set('from', merged.from)
      if (merged.to) p.set('to', merged.to)
      if (merged.userId) p.set('user_id', merged.userId)
      if (merged.action) p.set('action', merged.action)
      if ((merged.page ?? 1) > 1) p.set('page', String(merged.page))
      const qs = p.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [filters, page, pathname],
  )

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    router.push(
      buildUrl({
        from: String(fd.get('from') ?? ''),
        to: String(fd.get('to') ?? ''),
        userId: String(fd.get('user_id') ?? ''),
        action: String(fd.get('action') ?? ''),
        page: 1,
      }),
    )
  }

  function clearFilters() {
    formRef.current?.reset()
    router.push(pathname)
  }

  const hasFilters = filters.from || filters.to || filters.userId || filters.action

  return (
    <div className="space-y-4">
      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            แสดง{' '}
            <strong className="text-gray-900">
              {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)}
            </strong>{' '}
            จาก <strong className="text-gray-900">{total.toLocaleString('th-TH')}</strong> รายการ
          </span>
          {hasFilters && (
            <Badge variant="secondary" className="text-xs">
              กำลังกรอง
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            รีเฟรช
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCsv(logs)}
            className="gap-1.5 h-8 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Filter form ───────────────────────────────────────────── */}
      <form
        ref={formRef}
        onSubmit={handleFilterSubmit}
        className="bg-white border rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">กรองข้อมูล</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date from */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ตั้งแต่วันที่</label>
            <input
              type="date"
              name="from"
              defaultValue={filters.from}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ถึงวันที่</label>
            <input
              type="date"
              name="to"
              defaultValue={filters.to}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Action type */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ประเภท Action</label>
            <select
              name="action"
              defaultValue={filters.action}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">ทั้งหมด</option>
              {distinctActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* User ID */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">User ID (UUID)</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                name="user_id"
                defaultValue={filters.userId}
                placeholder="xxxxxxxx-xxxx-…"
                className="w-full text-sm border rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" className="h-8 text-xs px-4">
            กรอง
          </Button>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs px-3 gap-1 text-gray-500"
            >
              <X className="w-3 h-3" />
              ล้าง
            </Button>
          )}
        </div>
      </form>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left">
                <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  วันเวลา
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">ผู้ใช้</th>
                <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                <th className="px-4 py-3 font-medium text-gray-600">ทรัพยากร</th>
                <th className="px-4 py-3 font-medium text-gray-600">IP Address</th>
                <th className="px-4 py-3 font-medium text-gray-600">Metadata</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    ไม่พบข้อมูล Audit Log ตามเงื่อนไขที่กำหนด
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedId((prev) => (prev === log.id ? null : log.id))
                      }
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <time
                          className="text-xs text-gray-500 font-mono"
                          dateTime={log.created_at}
                        >
                          {formatTs(log.created_at)}
                        </time>
                      </td>

                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-gray-800 truncate max-w-[160px]">
                            {log.profiles?.full_name_th ?? (
                              <span className="text-gray-400 italic">ระบบ</span>
                            )}
                          </span>
                          {log.profiles?.role && (
                            <span className="text-[10px] text-gray-400">
                              {log.profiles.role}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-mono px-2 py-1 rounded-md ${actionBadgeClass(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Resource */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 font-mono">
                          {log.resource}
                        </span>
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-500">
                          {log.ip_address ?? '—'}
                        </span>
                      </td>

                      {/* Metadata preview */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="text-xs text-gray-400 truncate block">
                          {metaPreview(log.metadata ?? {})}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded row — full metadata */}
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-600 mb-2">
                              Metadata ทั้งหมด
                            </p>
                            <pre className="text-xs text-gray-700 bg-white border rounded-lg p-3 overflow-x-auto leading-relaxed">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                            {log.user_agent && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                User-Agent: {log.user_agent}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            หน้า {page} จาก {totalPages}
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              disabled={page <= 1}
              onClick={() => router.push(buildUrl({ page: page - 1 }))}
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const p = start + i
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="w-8 h-8 text-xs"
                  onClick={() => router.push(buildUrl({ page: p }))}
                >
                  {p}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              disabled={page >= totalPages}
              onClick={() => router.push(buildUrl({ page: page + 1 }))}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
