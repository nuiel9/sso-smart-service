import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AuditTable } from '@/components/admin/AuditTable'
import { logAuditFromServer, AuditAction } from '@/lib/audit/logger'

export const metadata: Metadata = {
  title: 'Audit Logs — SSO Smart Service',
  description: 'ประวัติการเข้าถึงข้อมูลส่วนบุคคลตาม PDPA',
}

const PAGE_SIZE = 50

interface SearchParams {
  page?: string
  from?: string
  to?: string
  user_id?: string
  action?: string
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // ── Auth & role check ────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/member')

  // ── Parse filters ────────────────────────────────────────────────────────
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = params.from ?? ''
  const to = params.to ?? ''
  const userId = params.user_id ?? ''
  const actionFilter = params.action ?? ''
  const offset = (page - 1) * PAGE_SIZE

  // ── Fetch audit logs ─────────────────────────────────────────────────────
  const service = await createServiceClient()

  let query = service
    .from('audit_logs')
    .select(
      `id, action, resource, ip_address, user_agent, metadata, created_at,
       profiles!audit_logs_user_id_fkey(full_name_th, role)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (from) query = query.gte('created_at', new Date(from).toISOString())
  if (to) {
    // ให้ "to" รวมทั้งวัน
    const toEnd = new Date(to)
    toEnd.setHours(23, 59, 59, 999)
    query = query.lte('created_at', toEnd.toISOString())
  }
  if (userId) query = query.eq('user_id', userId)
  if (actionFilter) query = query.eq('action', actionFilter)

  const { data: logs, count } = await query

  // ── Fetch distinct action types for filter dropdown ──────────────────────
  const { data: actionTypes } = await service
    .from('audit_logs')
    .select('action')
    .order('action')
    .limit(200)

  const distinctActions = [...new Set((actionTypes ?? []).map((r) => r.action))].sort()

  // ── Audit: admin viewed audit logs ───────────────────────────────────────
  await logAuditFromServer({
    userId: user.id,
    action: AuditAction.ADMIN_EXPORT_AUDIT,
    resource: 'audit_logs',
    metadata: { filters: { from, to, user_id: userId, action: actionFilter }, page },
  })

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            ประวัติการเข้าถึงข้อมูลส่วนบุคคลทั้งหมด · PDPA Compliance
          </p>
        </div>

        <AuditTable
          logs={logs ?? []}
          total={count ?? 0}
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          filters={{ from, to, userId, action: actionFilter }}
          distinctActions={distinctActions}
        />
      </div>
    </div>
  )
}
