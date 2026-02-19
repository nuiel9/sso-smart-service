import { createClient } from '@supabase/supabase-js'
import { pushMessage } from '@/lib/line/client'
import type { Database, NotificationType, NotificationChannel } from '@/lib/types/database'

// =============================================================================
// Types
// =============================================================================

export interface NotificationPayload {
  memberId: string
  type: NotificationType
  title: string
  body: string
  /** ช่องทางที่จะส่ง — default: ['push'] (in-app เสมอ) */
  channels?: NotificationChannel[]
  /** LINE userId สำหรับ LINE push (จาก line_user_mappings) */
  lineUserId?: string
  /** เบอร์โทรศัพท์ E.164 สำหรับ SMS */
  phone?: string
}

export interface SendResult {
  memberId: string
  success: boolean
  channels: NotificationChannel[]
  /** error description หรือ 'duplicate_skipped' */
  error?: string
}

// =============================================================================
// Internal helpers
// =============================================================================

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// =============================================================================
// Channel senders
// =============================================================================

/** บันทึก notification ลง DB (ใช้เป็น in-app push) */
async function sendInApp(
  memberId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('notifications').insert({
    member_id: memberId,
    type,
    title,
    body,
    channel: 'push',
  })
  if (error) throw new Error(`InApp insert failed: ${error.message}`)
}

/** ส่ง LINE push message ไปยัง userId */
async function sendLine(lineUserId: string, title: string, body: string): Promise<void> {
  await pushMessage(lineUserId, [
    {
      type: 'text',
      text: `🔔 ${title}\n\n${body}`,
    },
  ])
}

/**
 * ส่ง SMS ผ่าน generic HTTP provider
 * กำหนด endpoint ผ่าน env:
 *   SMS_API_URL    — URL ของ provider (เช่น https://api.thsms.com/v1/send)
 *   SMS_API_KEY    — Bearer token / API key
 *   SMS_SENDER_ID  — Sender name (default: SSO)
 */
async function sendSms(phone: string, body: string): Promise<void> {
  const apiUrl = process.env.SMS_API_URL
  const apiKey = process.env.SMS_API_KEY
  const sender = process.env.SMS_SENDER_ID ?? 'SSO'

  if (!apiUrl || !apiKey) {
    console.warn('[SMS] SMS_API_URL or SMS_API_KEY not configured — skipping SMS')
    return
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ to: phone, from: sender, message: body }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SMS provider error ${res.status}: ${text}`)
  }
}

// =============================================================================
// Deduplication
// =============================================================================

/**
 * ตรวจสอบว่า notification ประเภทเดียวกันถูกส่งให้ member นี้ใน 24h ที่ผ่านมาแล้วหรือไม่
 * ป้องกันการส่งซ้ำจาก cron job
 */
async function isDuplicate(memberId: string, type: NotificationType): Promise<boolean> {
  const supabase = createAdminClient()
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
// Public API
// =============================================================================

/**
 * ส่ง notification ผ่านช่องทางที่กำหนด พร้อม deduplication guard
 * @param skipDuplicateCheck — ตั้งเป็น true สำหรับการส่งจาก admin (manual override)
 */
export async function sendNotification(
  payload: NotificationPayload,
  skipDuplicateCheck = false,
): Promise<SendResult> {
  const { memberId, type, title, body, channels = ['push'], lineUserId, phone } = payload

  // Deduplication (auto-sent only)
  if (!skipDuplicateCheck && (await isDuplicate(memberId, type))) {
    return { memberId, success: true, channels: [], error: 'duplicate_skipped' }
  }

  const sent: NotificationChannel[] = []
  const errors: string[] = []

  // In-app push — ส่งทุกครั้งที่มี 'push' หรือไม่ระบุ channel
  if (channels.includes('push') || channels.length === 0) {
    try {
      await sendInApp(memberId, type, title, body)
      sent.push('push')
    } catch (err) {
      errors.push(`push: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // LINE push
  if (channels.includes('line') && lineUserId) {
    try {
      await sendLine(lineUserId, title, body)
      sent.push('line')
    } catch (err) {
      errors.push(`line: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // SMS
  if (channels.includes('sms') && phone) {
    try {
      await sendSms(phone, `${title}: ${body}`)
      sent.push('sms')
    } catch (err) {
      errors.push(`sms: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const success = sent.length > 0
  return {
    memberId,
    success,
    channels: sent,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

/**
 * ส่ง notification เป็น batch (max 10 concurrent) เพื่อลด rate-limit
 */
export async function sendBatchNotifications(
  payloads: NotificationPayload[],
): Promise<SendResult[]> {
  const BATCH_SIZE = 10
  const results: SendResult[] = []

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(batch.map((p) => sendNotification(p)))
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        results.push({
          memberId: 'unknown',
          success: false,
          channels: [],
          error: String(r.reason),
        })
      }
    }
  }

  return results
}
