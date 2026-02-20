import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { webhook } from '@line/bot-sdk'
import {
  verifyLineSignature,
  replyMessage,
  replyFlexMessage,
  type LineMessage,
} from '@/lib/line/client'
import {
  welcomeMessage,
  benefitsSummary,
  paymentStatus,
  consentRequest,
  escalationNotice,
  type BenefitItem,
  type PaymentData,
} from '@/lib/line/templates'
import { chat, calculateConfidence, CONFIDENCE_THRESHOLD } from '@/lib/ai/gemini'
import { getRelevantContext } from '@/lib/ai/rag'

// ---------------------------------------------------------------------------
// Supabase admin client (service role — no user cookie needed)
// ---------------------------------------------------------------------------

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// LINE user → deterministic member UUID
// When a LINE user hasn't linked their SSO account yet, we still need a
// stable member_id for chat_sessions. We derive a UUID v4-format string
// from their LINE userId (SHA-256 based). This allows audit trails to
// be consistent across sessions without schema changes.
// ---------------------------------------------------------------------------

function lineUserToMemberId(lineUserId: string): string {
  const hex = createHash('sha256').update(`line:${lineUserId}`).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    '8' + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-')
}

// ---------------------------------------------------------------------------
// Rate limit (30 messages/hour per LINE user, same logic as /api/chat)
// ---------------------------------------------------------------------------

async function isRateLimited(lineUserId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const memberId = lineUserToMemberId(lineUserId)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('member_id', memberId)

    if (!sessions || sessions.length === 0) return false

    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('session_id', sessions.map((s) => s.id))
      .eq('role', 'user')
      .gte('created_at', oneHourAgo)

    return (count ?? 0) >= 30
  } catch {
    return false // fail open
  }
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

async function logAudit(params: {
  lineUserId: string
  action: string
  metadata?: Record<string, unknown>
  ip?: string | null
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: params.action,
      resource: 'line_webhook',
      ip_address: params.ip ?? null,
      user_agent: 'LINE-WebhookClient',
      metadata: {
        line_user_id: params.lineUserId,
        ...(params.metadata ?? {}),
      },
    })
  } catch {
    // Audit failure must never block the main flow
  }
}

// ---------------------------------------------------------------------------
// Look up linked SSO account for a LINE user
// Returns the SSO profile if linked, or null if not yet linked.
// Requires a `line_user_mappings (id, line_user_id, user_id, created_at)`
// table in Supabase (migration required separately).
// ---------------------------------------------------------------------------

async function getLinkedProfile(lineUserId: string) {
  try {
    const supabase = createAdminClient()
    const { data: mapping } = await supabase
      .from('line_user_mappings')
      .select('user_id')
      .eq('line_user_id', lineUserId)
      .single()

    if (!mapping) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name_th, section_type, pdpa_consent, phone')
      .eq('id', mapping.user_id)
      .single()

    return profile ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Chat: get or create a session, then run AI and save messages
// ---------------------------------------------------------------------------

async function runAiChat(
  lineUserId: string,
  userMessage: string,
  ip: string | null
): Promise<{ text: string; shouldEscalate: boolean }> {
  const supabase = createAdminClient()
  const memberId = lineUserToMemberId(lineUserId)

  // Fetch RAG context
  const context = await getRelevantContext(userMessage)

  // Get or create LINE chat session
  let sessionId: string | null = null
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('member_id', memberId)
    .eq('channel', 'line')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    sessionId = existing.id
  } else {
    const { data: newSession } = await supabase
      .from('chat_sessions')
      .insert({ member_id: memberId, channel: 'line' })
      .select('id')
      .single()
    sessionId = newSession?.id ?? null
  }

  // Build recent history (last 6 messages)
  const history: { role: 'user' | 'assistant'; content: string }[] = []
  if (sessionId) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(6)

    if (msgs) {
      history.push(
        ...msgs
          .reverse()
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      )
    }
  }

  // Call Typhoon (non-streaming for LINE)
  const result = await chat(
    [...history, { role: 'user', content: userMessage }],
    context
  )

  const confidence = calculateConfidence(result.content)
  const shouldEscalate = confidence < CONFIDENCE_THRESHOLD

  // Persist messages
  if (sessionId) {
    await supabase.from('chat_messages').insert([
      { session_id: sessionId, role: 'user', content: userMessage },
      {
        session_id: sessionId,
        role: 'assistant',
        content: result.content,
        confidence_score: confidence,
        escalated: shouldEscalate,
      },
    ])
  }

  // Audit
  await logAudit({
    lineUserId,
    action: 'LINE_CHAT_MESSAGE',
    metadata: { session_id: sessionId, confidence, escalated: shouldEscalate },
    ip,
  })

  return { text: result.content, shouldEscalate }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleTextMessage(
  event: webhook.MessageEvent & { message: webhook.TextMessageContent },
  ip: string | null
) {
  if (!event.replyToken) return
  const lineUserId = event.source?.userId
  if (!lineUserId) return

  const text = event.message.text.trim()
  if (!text) return

  // Rate limit check
  if (await isRateLimited(lineUserId)) {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '⚠️ คุณส่งข้อความครบ 30 ครั้งในชั่วโมงนี้แล้ว กรุณารอ 1 ชั่วโมง หรือโทรสายด่วน 1506',
      },
    ])
    return
  }

  // Check if user is linked and has PDPA consent
  const profile = await getLinkedProfile(lineUserId)
  if (profile && !profile.pdpa_consent) {
    await replyFlexMessage(
      event.replyToken,
      'กรุณายอมรับ PDPA ก่อนใช้บริการ',
      consentRequest().contents
    )
    return
  }

  // Handle special commands
  if (text === 'เชื่อมบัญชี' || text === 'link') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: 'กรุณาส่งหมายเลขโทรศัพท์ที่ลงทะเบียนกับ สปส. เพื่อเชื่อมบัญชี เช่น: 0812345678',
      },
    ])
    return
  }

  // Thai phone number → trigger account linking
  if (/^0[6-9]\d{8}$/.test(text)) {
    await handlePhoneLinking(lineUserId, text, event.replyToken)
    return
  }

  // AI chat
  const { text: aiReply, shouldEscalate } = await runAiChat(lineUserId, text, ip)

  const messages: LineMessage[] = [{ type: 'text', text: aiReply }]

  if (shouldEscalate) {
    messages.push({
      type: 'flex',
      altText: 'ส่งต่อเจ้าหน้าที่',
      contents: escalationNotice().contents,
    })
  }

  await replyMessage(event.replyToken, messages)
}

async function handlePhoneLinking(
  lineUserId: string,
  phone: string,
  replyToken: string
) {
  try {
    const supabase = createAdminClient()

    // Look up by phone in profiles
    const e164 = '+66' + phone.slice(1)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name_th, pdpa_consent')
      .eq('phone', e164)
      .single()

    if (!profile) {
      await replyMessage(replyToken, [
        {
          type: 'text',
          text: `❌ ไม่พบบัญชีที่ลงทะเบียนด้วยเบอร์ ${phone}\nกรุณาตรวจสอบและลองอีกครั้ง หรือโทร 1506`,
        },
      ])
      return
    }

    // Create / update mapping
    await supabase.from('line_user_mappings').upsert(
      { line_user_id: lineUserId, user_id: profile.id },
      { onConflict: 'line_user_id' }
    )

    await logAudit({
      lineUserId,
      action: 'LINE_ACCOUNT_LINKED',
      metadata: { user_id: profile.id },
    })

    if (!profile.pdpa_consent) {
      // Must accept PDPA before proceeding
      await replyFlexMessage(
        replyToken,
        'กรุณายอมรับ PDPA',
        consentRequest().contents
      )
    } else {
      await replyMessage(replyToken, [
        {
          type: 'text',
          text: `✅ เชื่อมบัญชีสำเร็จ!\nยินดีต้อนรับ คุณ${profile.full_name_th ?? ''}\nสามารถถาม AI ผู้ช่วยหรือตรวจสอบสิทธิ์ได้เลยครับ`,
        },
      ])
    }
  } catch (err) {
    console.error('[LINE] handlePhoneLinking error:', err)
    await replyMessage(replyToken, [
      { type: 'text', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่หรือโทร 1506' },
    ])
  }
}

async function handleFollowEvent(event: webhook.FollowEvent, ip: string | null) {
  const lineUserId = event.source?.userId
  if (!lineUserId) return

  await logAudit({ lineUserId, action: 'LINE_FOLLOW', ip })

  const messages: LineMessage[] = [
    {
      type: 'flex',
      altText: 'ยินดีต้อนรับสู่ SSO Smart Service',
      contents: welcomeMessage().contents,
    },
    {
      type: 'flex',
      altText: 'กรุณายอมรับนโยบายความเป็นส่วนตัว',
      contents: consentRequest().contents,
    },
  ]

  await replyMessage(event.replyToken, messages)
}

async function handleUnfollowEvent(event: webhook.UnfollowEvent, ip: string | null) {
  const lineUserId = event.source?.userId
  if (!lineUserId) return
  await logAudit({ lineUserId, action: 'LINE_UNFOLLOW', ip })
}

async function handlePostbackEvent(event: webhook.PostbackEvent, ip: string | null) {
  if (!event.replyToken) return
  const lineUserId = event.source?.userId
  if (!lineUserId) return

  const data = event.postback.data
  const params = Object.fromEntries(new URLSearchParams(data))
  const action = params.action

  await logAudit({ lineUserId, action: `LINE_POSTBACK_${action?.toUpperCase()}`, ip })

  switch (action) {
    case 'check_benefits': {
      const profile = await getLinkedProfile(lineUserId)
      if (!profile) {
        await replyMessage(event.replyToken, [
          { type: 'text', text: 'กรุณาเชื่อมบัญชีก่อนตรวจสอบสิทธิ์ กด "เชื่อมบัญชี" หรือส่งเบอร์มือถือของคุณ' },
        ])
        return
      }
      const supabase = createAdminClient()
      const { data: benefitRows } = await supabase
        .from('benefits')
        .select('benefit_type, status, amount, expiry_date')
        .eq('member_id', profile.id)
        .limit(10)

      const items: BenefitItem[] = (benefitRows ?? []).map((b) => ({
        benefitType: b.benefit_type,
        title: BENEFIT_TITLES[b.benefit_type] ?? b.benefit_type,
        status: b.status,
        amount: b.amount,
        expiryDate: b.expiry_date,
      }))
      await replyFlexMessage(
        event.replyToken,
        'สิทธิประโยชน์ของคุณ',
        benefitsSummary(items).contents
      )
      break
    }

    case 'payment_status': {
      const now = new Date()
      const mockData: PaymentData = {
        month: now.toLocaleDateString('th-TH', {
          calendar: 'buddhist',
          month: 'long',
          year: 'numeric',
        }),
        wageAmount: 15000,
        contributionAmount: 750,
        status: 'pending',
      }
      await replyFlexMessage(
        event.replyToken,
        'สถานะเงินสมทบ',
        paymentStatus(mockData).contents
      )
      break
    }

    case 'chat': {
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '🤖 สอบถามเรื่องประกันสังคมได้เลยครับ เช่น:\n• สิทธิรักษาพยาบาลของฉัน\n• เงินว่างงานได้กี่เปอร์เซ็นต์\n• ขั้นตอนขอเงินชราภาพ',
        },
      ])
      break
    }

    case 'notifications': {
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '🔔 ระบบการแจ้งเตือนผ่าน LINE อยู่ระหว่างการเปิดใช้งาน\nกรุณาตรวจสอบการแจ้งเตือนในเว็บไซต์ หรือโทร 1506',
        },
      ])
      break
    }

    case 'section40': {
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text:
            '📋 ประกันสังคม มาตรา 40 (ผู้ประกอบอาชีพอิสระ)\n\n' +
            '• ชำระ 70 บาท/เดือน → รับ 3 สิทธิ์\n' +
            '• ชำระ 100 บาท/เดือน → รับ 4 สิทธิ์\n\n' +
            'สิทธิ์ที่ได้รับ: เจ็บป่วย, ทุพพลภาพ, เสียชีวิต, ชราภาพ\n\n' +
            'สอบถามเพิ่มเติม: โทร 1506',
        },
      ])
      break
    }

    case 'pdpa_consent_accept': {
      await handlePdpaConsent(lineUserId, true, event.replyToken)
      break
    }

    case 'pdpa_consent_decline': {
      await handlePdpaConsent(lineUserId, false, event.replyToken)
      break
    }

    case 'benefit_detail': {
      const benefitType = params.type ?? 'unknown'
      await replyMessage(event.replyToken, [
        { type: 'text', text: `กรุณาดูรายละเอียดสิทธิ์ "${BENEFIT_TITLES[benefitType] ?? benefitType}" ในเว็บไซต์ หรือโทร 1506` },
      ])
      break
    }

    case 'link_account': {
      await replyMessage(event.replyToken, [
        { type: 'text', text: 'กรุณาส่งหมายเลขโทรศัพท์ที่ลงทะเบียนกับ สปส. เช่น: 0812345678' },
      ])
      break
    }

    case 'payment_history': {
      await replyMessage(event.replyToken, [
        { type: 'text', text: 'กรุณาดูประวัติการชำระเงินในเว็บไซต์ sso.go.th หรือโทร 1506' },
      ])
      break
    }

    default: {
      await replyMessage(event.replyToken, [
        { type: 'text', text: 'ไม่รู้จักคำสั่งนี้ กรุณาใช้เมนูด้านล่าง หรือพิมพ์คำถามได้เลยครับ' },
      ])
    }
  }
}

async function handlePdpaConsent(
  lineUserId: string,
  accepted: boolean,
  replyToken: string
) {
  try {
    const profile = await getLinkedProfile(lineUserId)

    if (profile) {
      const supabase = createAdminClient()
      await supabase
        .from('profiles')
        .update({
          pdpa_consent: accepted,
          pdpa_consent_date: new Date().toISOString(),
        })
        .eq('id', profile.id)
    }

    await logAudit({
      lineUserId,
      action: accepted ? 'PDPA_CONSENT_ACCEPTED' : 'PDPA_CONSENT_DECLINED',
    })

    if (accepted) {
      await replyMessage(replyToken, [
        {
          type: 'text',
          text: '✅ ขอบคุณที่ยอมรับนโยบายความเป็นส่วนตัว\nสามารถใช้บริการได้เลยครับ พิมพ์คำถามหรือใช้เมนูด้านล่าง',
        },
      ])
    } else {
      await replyMessage(replyToken, [
        {
          type: 'text',
          text: 'รับทราบครับ หากต้องการใช้บริการในภายหลัง กรุณากดยอมรับนโยบายอีกครั้ง หรือโทร 1506',
        },
      ])
    }
  } catch (err) {
    console.error('[LINE] handlePdpaConsent error:', err)
  }
}

// ---------------------------------------------------------------------------
// Benefit type labels
// ---------------------------------------------------------------------------

const BENEFIT_TITLES: Record<string, string> = {
  healthcare: 'รักษาพยาบาล',
  unemployment: 'ว่างงาน',
  childbirth: 'คลอดบุตร',
  child_support: 'สงเคราะห์บุตร',
  disability: 'ทุพพลภาพ',
  old_age: 'ชราภาพ',
  death: 'เสียชีวิต',
}

// ---------------------------------------------------------------------------
// Main webhook handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''
  const ip = request.headers.get('x-forwarded-for')

  // Verify LINE signature first
  if (!verifyLineSignature(rawBody, signature)) {
    console.warn('[LINE] Invalid webhook signature')
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: webhook.CallbackRequest
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Process events concurrently — individual failures don't affect others
  await Promise.allSettled(
    payload.events.map(async (event) => {
      try {
        switch (event.type) {
          case 'message': {
            const msgEvent = event as webhook.MessageEvent
            if (msgEvent.message.type === 'text') {
              await handleTextMessage(
                msgEvent as webhook.MessageEvent & { message: webhook.TextMessageContent },
                ip
              )
            }
            break
          }
          case 'follow':
            await handleFollowEvent(event as webhook.FollowEvent, ip)
            break
          case 'unfollow':
            await handleUnfollowEvent(event as webhook.UnfollowEvent, ip)
            break
          case 'postback':
            await handlePostbackEvent(event as webhook.PostbackEvent, ip)
            break
          // Other event types are silently ignored
        }
      } catch (err) {
        console.error(`[LINE] Error handling event type=${event.type}:`, err)
      }
    })
  )

  // LINE requires a 200 response within 1 second of receiving
  return new Response('OK', { status: 200 })
}

// Allow LINE to verify the webhook endpoint with a GET request
export async function GET() {
  return new Response('LINE Webhook OK', { status: 200 })
}
