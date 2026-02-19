/**
 * Supabase Edge Function: predict-notifications
 *
 * รันเป็น Scheduled Function ทุกวัน 08:00 ICT (01:00 UTC)
 * มี logic เดียวกับ /app/api/notifications/predict/route.ts
 * แต่รันบน Deno runtime ของ Supabase โดยตรง (ไม่ผ่าน Next.js)
 *
 * Deploy:
 *   supabase functions deploy predict-notifications
 *
 * Schedule (Supabase Dashboard → Edge Functions → Schedule):
 *   Cron: 0 1 * * *   (01:00 UTC = 08:00 ICT)
 *
 * หรือตั้งผ่าน pg_cron:
 *   SELECT cron.schedule(
 *     'daily-notification-predict',
 *     '0 1 * * *',
 *     $$SELECT net.http_post(
 *       url := current_setting('app.supabase_url') || '/functions/v1/predict-notifications',
 *       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
 *     )$$
 *   );
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'

// =============================================================================
// Types (minimal — mirrors lib/types/database.ts)
// =============================================================================

type NotificationType = 'benefit_reminder' | 'payment_status' | 'section40_outreach' | 'system'
type NotificationChannel = 'push' | 'line' | 'sms'

interface NotificationPayload {
  memberId: string
  type: NotificationType
  title: string
  body: string
  channels: NotificationChannel[]
  lineUserId?: string
  phone?: string
}

interface SendResult {
  memberId: string
  success: boolean
  channels: NotificationChannel[]
  error?: string
}

// =============================================================================
// Environment
// =============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
const SMS_API_URL = Deno.env.get('SMS_API_URL') ?? ''
const SMS_API_KEY = Deno.env.get('SMS_API_KEY') ?? ''
const SMS_SENDER_ID = Deno.env.get('SMS_SENDER_ID') ?? 'SSO'

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// =============================================================================
// Benefit labels
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
// LINE user lookup
// =============================================================================

async function getLineUserIds(
  supabase: ReturnType<typeof createAdminClient>,
  memberIds: string[],
): Promise<Map<string, string>> {
  if (memberIds.length === 0) return new Map()
  const { data } = await supabase
    .from('line_user_mappings')
    .select('user_id, line_user_id')
    .in('user_id', memberIds)
  const map = new Map<string, string>()
  for (const row of (data ?? []) as any[]) {
    map.set(row.user_id, row.line_user_id)
  }
  return map
}

// =============================================================================
// Deduplication
// =============================================================================

async function isDuplicate(
  supabase: ReturnType<typeof createAdminClient>,
  memberId: string,
  type: NotificationType,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('type', type)
    .gte('sent_at', since)
  return (count ?? 0) > 0
}

// =============================================================================
// Channel senders
// =============================================================================

async function sendInApp(
  supabase: ReturnType<typeof createAdminClient>,
  memberId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    member_id: memberId,
    type,
    title,
    body,
    channel: 'push',
  })
  if (error) throw new Error(`InApp: ${error.message}`)
}

async function sendLine(lineUserId: string, title: string, body: string): Promise<void> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: `🔔 ${title}\n\n${body}` }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LINE push error ${res.status}: ${text}`)
  }
}

async function sendSms(phone: string, body: string): Promise<void> {
  if (!SMS_API_URL || !SMS_API_KEY) return
  const res = await fetch(SMS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SMS_API_KEY}`,
    },
    body: JSON.stringify({ to: phone, from: SMS_SENDER_ID, message: body }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SMS error ${res.status}: ${text}`)
  }
}

// =============================================================================
// Send single notification with deduplication
// =============================================================================

async function sendNotification(
  supabase: ReturnType<typeof createAdminClient>,
  payload: NotificationPayload,
): Promise<SendResult> {
  const { memberId, type, title, body, channels, lineUserId, phone } = payload

  if (await isDuplicate(supabase, memberId, type)) {
    return { memberId, success: true, channels: [], error: 'duplicate_skipped' }
  }

  const sent: NotificationChannel[] = []
  const errors: string[] = []

  if (channels.includes('push')) {
    try {
      await sendInApp(supabase, memberId, type, title, body)
      sent.push('push')
    } catch (e) {
      errors.push(`push: ${e}`)
    }
  }

  if (channels.includes('line') && lineUserId) {
    try {
      await sendLine(lineUserId, title, body)
      sent.push('line')
    } catch (e) {
      errors.push(`line: ${e}`)
    }
  }

  if (channels.includes('sms') && phone) {
    try {
      await sendSms(phone, `${title}: ${body}`)
      sent.push('sms')
    } catch (e) {
      errors.push(`sms: ${e}`)
    }
  }

  return {
    memberId,
    success: sent.length > 0,
    channels: sent,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

// =============================================================================
// Prediction tasks (mirrors Next.js route)
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
  const memberIds = [...new Set((data as any[]).map((r: any) => r.member_id))]
  const lineMap = await getLineUserIds(supabase, memberIds)

  return (data as any[]).map((row: any) => {
    const profile = row.profiles as { phone: string | null }
    const daysLeft = Math.ceil(
      (new Date(row.expiry_date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    )
    return {
      memberId: row.member_id,
      type: 'benefit_reminder' as const,
      title: `สิทธิ์ ${BENEFIT_TH[row.benefit_type] ?? row.benefit_type} ใกล้หมดอายุ`,
      body: `สิทธิ์ของคุณจะหมดอายุในอีก ${daysLeft} วัน (${row.expiry_date}) กรุณาดำเนินการก่อนหมดเขต`,
      channels: ['push', ...(lineMap.has(row.member_id) ? ['line'] : [])] as NotificationChannel[],
      lineUserId: lineMap.get(row.member_id),
      phone: profile.phone ?? undefined,
    }
  })
}

async function predictUnusedBenefits(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<NotificationPayload[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const { data } = await supabase
    .from('benefits')
    .select('member_id, benefit_type, profiles!inner(phone)')
    .eq('status', 'active')
    .is('claimed_at', null)
    .lte('eligible_date', thirtyDaysAgo.toISOString().split('T')[0])

  if (!data || data.length === 0) return []
  const memberIds = [...new Set((data as any[]).map((r: any) => r.member_id))]
  const lineMap = await getLineUserIds(supabase, memberIds)

  return (data as any[]).map((row: any) => {
    const profile = row.profiles as { phone: string | null }
    return {
      memberId: row.member_id,
      type: 'benefit_reminder' as const,
      title: `คุณยังมีสิทธิ์ ${BENEFIT_TH[row.benefit_type] ?? row.benefit_type} ที่ยังไม่ได้ใช้`,
      body: 'คุณมีสิทธิ์ประกันสังคมที่ยังไม่ได้ใช้งาน ตรวจสอบและใช้สิทธิ์ได้ที่ SSO Smart Service',
      channels: ['push', ...(lineMap.has(row.member_id) ? ['line'] : [])] as NotificationChannel[],
      lineUserId: lineMap.get(row.member_id),
      phone: profile.phone ?? undefined,
    }
  })
}

async function predictSection40Outreach(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<NotificationPayload[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, phone')
    .eq('role', 'member')
    .is('section_type', null)
    .eq('pdpa_consent', true)

  if (!data || data.length === 0) return []
  const memberIds = (data as any[]).map((r: any) => r.id)
  const lineMap = await getLineUserIds(supabase, memberIds)

  return (data as any[]).map((profile: any) => ({
    memberId: profile.id,
    type: 'section40_outreach' as const,
    title: 'สมัครประกันสังคม มาตรา 40 วันนี้',
    body: 'ผู้ประกอบอาชีพอิสระ สมัครได้ง่าย เพียง 70-100 บาท/เดือน รับสิทธิ์เจ็บป่วย ทุพพลภาพ ชราภาพ',
    channels: ['push', ...(lineMap.has(profile.id) ? ['line'] : [])] as NotificationChannel[],
    lineUserId: lineMap.get(profile.id),
    phone: profile.phone ?? undefined,
  }))
}

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
  const memberIds = [...new Set((data as any[]).map((r: any) => r.member_id))]
  const lineMap = await getLineUserIds(supabase, memberIds)

  return (data as any[]).map((row: any) => {
    const profile = row.profiles as { phone: string | null }
    const approved = row.status === 'active'
    const benefitName = BENEFIT_TH[row.benefit_type] ?? row.benefit_type
    const amountStr = row.amount ? `฿${Number(row.amount).toLocaleString('th-TH')}` : ''

    return {
      memberId: row.member_id,
      type: 'payment_status' as const,
      title: approved ? `อนุมัติสิทธิ์ ${benefitName} แล้ว` : `สิทธิ์ ${benefitName} ไม่ผ่านการพิจารณา`,
      body: approved
        ? `สิทธิ์ ${benefitName} ของคุณได้รับการอนุมัติ${amountStr ? ` จำนวน ${amountStr}` : ''} ตรวจสอบรายละเอียดในแอป`
        : `สิทธิ์ ${benefitName} ไม่ผ่านการพิจารณา กรุณาติดต่อสำนักงานประกันสังคม โทร 1506`,
      channels: ['push', ...(lineMap.has(row.member_id) ? ['line'] : [])] as NotificationChannel[],
      lineUserId: lineMap.get(row.member_id),
      phone: profile.phone ?? undefined,
    }
  })
}

// =============================================================================
// Batch sender
// =============================================================================

async function sendBatch(
  supabase: ReturnType<typeof createAdminClient>,
  payloads: NotificationPayload[],
): Promise<SendResult[]> {
  const BATCH_SIZE = 10
  const results: SendResult[] = []
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(batch.map((p) => sendNotification(supabase, p)))
    for (const r of settled) {
      results.push(
        r.status === 'fulfilled'
          ? r.value
          : { memberId: 'unknown', success: false, channels: [], error: String(r.reason) },
      )
    }
  }
  return results
}

// =============================================================================
// Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  const supabase = createAdminClient()
  const startTime = Date.now()

  try {
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

    const results = await sendBatch(supabase, allPayloads)

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

    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'edge_fn_predict_notifications',
      resource: 'notifications',
      metadata: summary,
    })

    console.log('[predict-notifications]', JSON.stringify(summary))

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[predict-notifications] fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
