/**
 * POST /api/notifications/predict
 *
 * Predictive Notification Engine — ทำงานผ่าน Vercel Cron ทุกวัน 08:00 ICT
 * Secured by CRON_SECRET (Bearer token)
 *
 * Logic:
 *   a. สิทธิ์ใกล้หมดอายุ (≤ 30 วัน)          → benefit_reminder
 *   b. สิทธิ์ active ที่ยังไม่ได้ใช้ (> 30 วัน) → benefit_reminder
 *   c. แรงงานนอกระบบ ยังไม่มี section_type      → section40_outreach
 *   d. สิทธิ์ที่เพิ่งเปลี่ยนสถานะ (24h)         → payment_status
 *
 * ทุก task มี deduplication: ไม่ส่งซ้ำใน 24h
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBatchNotifications } from '@/lib/notifications/sender'
import type { NotificationPayload } from '@/lib/notifications/sender'
import type { Database } from '@/lib/types/database'

// =============================================================================
// Auth guard
// =============================================================================

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[predict] CRON_SECRET not set')
    return false
  }
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// =============================================================================
// Supabase admin client (service role, no cookies)
// =============================================================================

function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// =============================================================================
// LINE user lookup helper
// =============================================================================

async function getLineUserIds(
  supabase: ReturnType<typeof createAdminClient>,
  memberIds: string[],
): Promise<Map<string, string>> {
  if (memberIds.length === 0) return new Map()
  const { data } = await supabase
    .from('line_user_mappings' as never)
    .select('user_id, line_user_id')
    .in('user_id', memberIds) as { data: { user_id: string; line_user_id: string }[] | null }
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.user_id, row.line_user_id)
  }
  return map
}

// =============================================================================
// Benefit type Thai labels
// =============================================================================

const BENEFIT_TH: Record<string, string> = {
  healthcare: 'รักษาพยาบาล',
  unemployment: 'ว่างงาน',
  childbirth: 'คลอดบุตร',
  child_support: 'สงเคราะห์บุตร',
  disability: 'ทุพพลภาพ',
  old_age: 'ชราภาพ',
  death: 'เสียชีวิต',
}

// =============================================================================
// Task a: สิทธิ์ใกล้หมดอายุ (expiry_date ≤ 30 วัน)
// =============================================================================

async function predictBenefitExpiry(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<NotificationPayload[]> {
  const today = new Date()
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data } = await supabase
    .from('benefits')
    .select('member_id, benefit_type, expiry_date, profiles!inner(phone)')
    .eq('status', 'active')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', in30Days.toISOString().split('T')[0])
    .gte('expiry_date', today.toISOString().split('T')[0])

  if (!data || data.length === 0) return []

  const memberIds = [...new Set(data.map((r) => r.member_id))]
  const lineMap = await getLineUserIds(supabase, memberIds)

  return data.map((row) => {
    const profile = row.profiles as unknown as { phone: string | null }
    const daysLeft = Math.ceil(
      (new Date(row.expiry_date!).getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    )
    const benefitName = BENEFIT_TH[row.benefit_type] ?? row.benefit_type

    return {
      memberId: row.member_id,
      type: 'benefit_reminder' as const,
      title: `สิทธิ์ ${benefitName} ใกล้หมดอายุ`,
      body: `สิทธิ์ของคุณจะหมดอายุในอีก ${daysLeft} วัน (${row.expiry_date}) กรุณาดำเนินการก่อนหมดเขต`,
      channels: ['push' as const, ...(lineMap.has(row.member_id) ? (['line' as const]) : [])],
      lineUserId: lineMap.get(row.member_id),
      phone: profile.phone ?? undefined,
    }
  })
}

// =============================================================================
// Task b: สิทธิ์ active ที่ยังไม่ได้ใช้มากกว่า 30 วัน
// =============================================================================

async function predictUnusedBenefits(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<NotificationPayload[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const { data } = await supabase
    .from('benefits')
    .select('member_id, benefit_type, eligible_date, profiles!inner(phone)')
    .eq('status', 'active')
    .is('claimed_at', null)
    .lte('eligible_date', thirtyDaysAgo.toISOString().split('T')[0])

  if (!data || data.length === 0) return []

  const memberIds = [...new Set(data.map((r) => r.member_id))]
  const lineMap = await getLineUserIds(supabase, memberIds)

  return data.map((row) => {
    const profile = row.profiles as unknown as { phone: string | null }
    const benefitName = BENEFIT_TH[row.benefit_type] ?? row.benefit_type

    return {
      memberId: row.member_id,
      type: 'benefit_reminder' as const,
      title: `คุณยังมีสิทธิ์ ${benefitName} ที่ยังไม่ได้ใช้`,
      body: 'คุณมีสิทธิ์ประกันสังคมที่ยังไม่ได้ใช้งาน ตรวจสอบและใช้สิทธิ์ได้ที่ SSO Smart Service',
      channels: ['push' as const, ...(lineMap.has(row.member_id) ? (['line' as const]) : [])],
      lineUserId: lineMap.get(row.member_id),
      phone: profile.phone ?? undefined,
    }
  })
}

// =============================================================================
// Task c: มาตรา 40 — แรงงานนอกระบบที่ยังไม่มี section_type (outreach)
// =============================================================================

async function predictSection40Outreach(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<NotificationPayload[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, phone')
    .eq('role', 'member')
    .is('section_type', null)
    .eq('pdpa_consent', true) // outreach เฉพาะผู้ที่ให้ consent แล้ว

  if (!data || data.length === 0) return []

  const memberIds = data.map((r) => r.id)
  const lineMap = await getLineUserIds(supabase, memberIds)

  return data.map((profile) => ({
    memberId: profile.id,
    type: 'section40_outreach' as const,
    title: 'สมัครประกันสังคม มาตรา 40 วันนี้',
    body: 'ผู้ประกอบอาชีพอิสระ สมัครได้ง่าย เพียง 70-100 บาท/เดือน รับสิทธิ์เจ็บป่วย ทุพพลภาพ ชราภาพ',
    channels: ['push' as const, ...(lineMap.has(profile.id) ? (['line' as const]) : [])],
    lineUserId: lineMap.get(profile.id),
    phone: profile.phone ?? undefined,
  }))
}

// =============================================================================
// Task d: สิทธิ์ที่เพิ่งเปลี่ยนสถานะ (active/expired) ใน 24h → payment_status
// =============================================================================

async function predictPaymentStatus(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<NotificationPayload[]> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('benefits')
    .select('member_id, benefit_type, status, amount, profiles!inner(phone)')
    .in('status', ['active', 'expired'])
    .gte('updated_at', yesterday)
    .not('amount', 'is', null)

  if (!data || data.length === 0) return []

  const memberIds = [...new Set(data.map((r) => r.member_id))]
  const lineMap = await getLineUserIds(supabase, memberIds)

  return data.map((row) => {
    const profile = row.profiles as unknown as { phone: string | null }
    const approved = row.status === 'active'
    const benefitName = BENEFIT_TH[row.benefit_type] ?? row.benefit_type
    const amountStr = row.amount ? `฿${Number(row.amount).toLocaleString('th-TH')}` : ''

    return {
      memberId: row.member_id,
      type: 'payment_status' as const,
      title: approved
        ? `อนุมัติสิทธิ์ ${benefitName} แล้ว`
        : `สิทธิ์ ${benefitName} ไม่ผ่านการพิจารณา`,
      body: approved
        ? `สิทธิ์ ${benefitName} ของคุณได้รับการอนุมัติ${amountStr ? ` จำนวน ${amountStr}` : ''} ตรวจสอบรายละเอียดในแอป`
        : `สิทธิ์ ${benefitName} ไม่ผ่านการพิจารณา กรุณาติดต่อสำนักงานประกันสังคม โทร 1506`,
      channels: ['push' as const, ...(lineMap.has(row.member_id) ? (['line' as const]) : [])],
      lineUserId: lineMap.get(row.member_id),
      phone: profile.phone ?? undefined,
    }
  })
}

// =============================================================================
// Handler
// =============================================================================

async function runPrediction(request: NextRequest): Promise<NextResponse> {
  const supabase = createAdminClient()
  const startTime = Date.now()

  const [expiryPayloads, unusedPayloads, section40Payloads, paymentPayloads] =
    await Promise.all([
      predictBenefitExpiry(supabase),
      predictUnusedBenefits(supabase),
      predictSection40Outreach(supabase),
      predictPaymentStatus(supabase),
    ])

  const allPayloads = [
    ...expiryPayloads,
    ...unusedPayloads,
    ...section40Payloads,
    ...paymentPayloads,
  ]

  const results = await sendBatchNotifications(allPayloads)

  const sent = results.filter((r) => r.success && r.channels.length > 0).length
  const skipped = results.filter((r) => r.error === 'duplicate_skipped').length
  const failed = results.filter((r) => !r.success && r.error !== 'duplicate_skipped').length

  const summary = {
    total: allPayloads.length,
    sent,
    skipped,
    failed,
    breakdown: {
      expiry: expiryPayloads.length,
      unused: unusedPayloads.length,
      section40: section40Payloads.length,
      payment: paymentPayloads.length,
    },
    duration_ms: Date.now() - startTime,
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: null,
    action: 'cron_predict_notifications',
    resource: 'notifications',
    ip_address: request.headers.get('x-forwarded-for'),
    metadata: summary,
  })

  console.info('[predict-notifications] completed', summary)
  return NextResponse.json({ success: true, ...summary })
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return await runPrediction(request)
  } catch (err) {
    console.error('[predict-notifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** GET สำหรับ manual trigger ใน dev environment */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 })
  }
  return runPrediction(request)
}
