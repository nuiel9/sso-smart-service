/**
 * GET/POST /api/member/data-export
 *
 * PDPA มาตรา 63 — สิทธิ์การเข้าถึงและรับข้อมูลส่วนบุคคล
 *
 * ข้อกำหนด:
 *   - ต้อง re-authenticate ด้วยรหัสผ่านก่อน export
 *   - บันทึก audit log ทุกครั้ง
 *   - Export ข้อมูลทั้งหมดที่เกี่ยวกับ user: profile, benefits, chat, notifications, audit
 *
 * Request (POST):
 *   Body: { password: string, format?: 'json' | 'csv' }
 *
 * Response:
 *   JSON: { profile, benefits, chat_sessions, notifications, audit_logs }
 *   CSV:  text/csv พร้อม sections แยกตามประเภทข้อมูล
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { logAudit, logAuditFromRequest, AuditAction } from '@/lib/audit/logger'

// =============================================================================
// Re-authentication via password
// =============================================================================

async function verifyPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return false

  const client = createAnonClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await client.auth.signInWithPassword({ email, password })
  return !error
}

// =============================================================================
// CSV helpers
// =============================================================================

function objectsToCsvSection(title: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `## ${title}\n(ไม่มีข้อมูล)\n\n`
  const keys = Object.keys(rows[0])
  const header = keys.join(',')
  const body = rows
    .map((row) =>
      keys
        .map((k) => {
          const val = row[k]
          if (val === null || val === undefined) return ''
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
          // Escape commas and newlines
          return str.includes(',') || str.includes('\n') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(','),
    )
    .join('\n')
  return `## ${title}\n${header}\n${body}\n\n`
}

// =============================================================================
// POST /api/member/data-export
// =============================================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const service = await createServiceClient()

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let password: string
  let format: 'json' | 'csv' = 'json'
  try {
    const body = await request.json()
    password = body.password
    format = body.format === 'csv' ? 'csv' : 'json'
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!password) {
    return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน' }, { status: 400 })
  }

  // 3. Re-authenticate — get email from auth.admin
  const { data: authUser, error: adminErr } = await service.auth.admin.getUserById(user.id)
  if (adminErr || !authUser.user?.email) {
    return NextResponse.json({ error: 'ไม่สามารถยืนยันตัวตนได้' }, { status: 500 })
  }

  const passwordValid = await verifyPassword(authUser.user.email, password)
  if (!passwordValid) {
    // Log failed attempt
    await logAuditFromRequest(request, {
      userId: user.id,
      action: AuditAction.DATA_EXPORT,
      resource: 'data_export',
      metadata: { status: 'failed_reauth', format },
    })
    return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 403 })
  }

  // 4. Fetch all user data
  const [profileRes, benefitsRes, sessionsRes, notificationsRes, auditRes] =
    await Promise.all([
      service
        .from('profiles')
        .select(
          'id, full_name_th, full_name_en, phone, role, sso_member_id, section_type, zone_id, pdpa_consent, pdpa_consent_date, created_at, updated_at',
        )
        .eq('id', user.id)
        .single(),
      service
        .from('benefits')
        .select('id, benefit_type, status, amount, eligible_date, expiry_date, claimed_at, created_at, updated_at')
        .eq('member_id', user.id)
        .order('created_at', { ascending: false }),
      service
        .from('chat_sessions')
        .select(
          'id, channel, started_at, ended_at, satisfaction_score, chat_messages(id, role, content, confidence_score, escalated, created_at)',
        )
        .eq('member_id', user.id)
        .order('started_at', { ascending: false })
        .limit(100),
      service
        .from('notifications')
        .select('id, type, title, body, channel, read, sent_at, read_at')
        .eq('member_id', user.id)
        .order('sent_at', { ascending: false }),
      service
        .from('audit_logs')
        .select('id, action, resource, ip_address, metadata, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

  // 5. Audit log the export
  await logAuditFromRequest(request, {
    userId: user.id,
    action: AuditAction.DATA_EXPORT,
    resource: 'data_export',
    metadata: {
      format,
      exported_at: new Date().toISOString(),
      record_counts: {
        profile: profileRes.data ? 1 : 0,
        benefits: benefitsRes.data?.length ?? 0,
        chat_sessions: sessionsRes.data?.length ?? 0,
        notifications: notificationsRes.data?.length ?? 0,
        audit_logs: auditRes.data?.length ?? 0,
      },
    },
  })

  const exportData = {
    exported_at: new Date().toISOString(),
    data_subject: authUser.user.email,
    legal_basis: 'PDPA มาตรา 63 — สิทธิ์การเข้าถึงและรับข้อมูลส่วนบุคคล',
    profile: profileRes.data,
    benefits: benefitsRes.data ?? [],
    chat_sessions: sessionsRes.data ?? [],
    notifications: notificationsRes.data ?? [],
    audit_logs: auditRes.data ?? [],
  }

  // 6. Return in requested format
  if (format === 'csv') {
    const profile = profileRes.data ? [profileRes.data as Record<string, unknown>] : []
    const benefits = (benefitsRes.data ?? []) as Record<string, unknown>[]
    const notifications = (notificationsRes.data ?? []) as Record<string, unknown>[]
    const auditLogs = (auditRes.data ?? []).map((l) => ({
      ...l,
      metadata: JSON.stringify(l.metadata),
    })) as Record<string, unknown>[]

    const csv = [
      `# SSO Smart Service — ข้อมูลส่วนบุคคล\n# ส่งออกเมื่อ: ${exportData.exported_at}\n# อีเมล: ${exportData.data_subject}\n\n`,
      objectsToCsvSection('ข้อมูลโปรไฟล์', profile),
      objectsToCsvSection('สิทธิประโยชน์', benefits),
      objectsToCsvSection('การแจ้งเตือน', notifications),
      objectsToCsvSection('ประวัติการใช้งาน (Audit)', auditLogs),
    ].join('')

    const filename = `sso-data-export-${user.id.slice(0, 8)}-${Date.now()}.csv`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // Default: JSON
  const filename = `sso-data-export-${user.id.slice(0, 8)}-${Date.now()}.json`
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// =============================================================================
// GET — export page (renders download UI)
// =============================================================================

export async function GET() {
  return NextResponse.json(
    {
      description: 'PDPA Data Export — POST with { password, format? }',
      formats: ['json', 'csv'],
      note: 'ต้องยืนยันรหัสผ่านก่อน export ทุกครั้ง (re-authentication)',
    },
    { status: 200 },
  )
}
