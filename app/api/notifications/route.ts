import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications/sender'
import type { NotificationChannel, NotificationType } from '@/lib/types/database'

// =============================================================================
// GET /api/notifications
// ดึง notifications ของ user ปัจจุบัน (paginated + filterable)
//
// Query params:
//   page    — หน้า (default: 1)
//   limit   — จำนวนต่อหน้า (default: 20, max: 50)
//   type    — filter ตาม NotificationType
//   read    — 'true' | 'false' | ไม่ระบุ (ทั้งหมด)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const typeFilter = searchParams.get('type') as NotificationType | null
    const readFilter = searchParams.get('read') // 'true' | 'false' | null

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('member_id', user.id)
      .order('sent_at', { ascending: false })
      .range(from, to)

    if (typeFilter) query = query.eq('type', typeFilter)
    if (readFilter === 'true') query = query.eq('read', true)
    if (readFilter === 'false') query = query.eq('read', false)

    const { data: notifications, count, error } = await query

    if (error) throw error

    return NextResponse.json({
      notifications: notifications ?? [],
      total: count ?? 0,
      page,
      limit,
      hasMore: (count ?? 0) > page * limit,
    })
  } catch (err) {
    console.error('[GET /api/notifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// PATCH /api/notifications
// Mark notification(s) as read
//
// Body: { ids?: string[], all?: boolean }
//   ids  — อาร์เรย์ของ notification id ที่ต้องการ mark as read
//   all  — true เพื่อ mark ทั้งหมดของ user นี้ว่าอ่านแล้ว
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, all } = body as { ids?: string[]; all?: boolean }

    if (!all && (!Array.isArray(ids) || ids.length === 0)) {
      return NextResponse.json(
        { error: 'Provide ids[] or all: true' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()

    let query = supabase
      .from('notifications')
      .update({ read: true, read_at: now })
      .eq('member_id', user.id)
      .eq('read', false)

    if (!all && ids) {
      query = query.in('id', ids)
    }

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/notifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// POST /api/notifications  — admin only
// สร้าง notification และส่งผ่านช่องทางที่เลือก
//
// Body:
//   member_id  — UUID ของผู้รับ
//   type       — NotificationType
//   title      — หัวข้อ
//   body       — เนื้อหา
//   channel    — ช่องทาง (optional, default: push)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    const raw = await request.json()
    const {
      member_id,
      type,
      title,
      body: msgBody,
      channel,
    } = raw as {
      member_id: string
      type: NotificationType
      title: string
      body: string
      channel?: NotificationChannel
    }

    if (!member_id || !type || !title || !msgBody) {
      return NextResponse.json(
        { error: 'member_id, type, title, body are required' },
        { status: 400 },
      )
    }

    const service = await createServiceClient()

    // Look up LINE userId if needed
    let lineUserId: string | undefined
    if (!channel || channel === 'line') {
      const { data: mapping } = await service
        .from('line_user_mappings' as never)
        .select('line_user_id')
        .eq('user_id', member_id)
        .maybeSingle() as { data: { line_user_id: string } | null }
      lineUserId = mapping?.line_user_id
    }

    // Look up phone if needed
    let phone: string | undefined
    if (!channel || channel === 'sms') {
      const { data: target } = await service
        .from('profiles')
        .select('phone')
        .eq('id', member_id)
        .single()
      phone = target?.phone ?? undefined
    }

    const channels: NotificationChannel[] = channel ? [channel] : ['push']

    const result = await sendNotification(
      { memberId: member_id, type, title, body: msgBody, channels, lineUserId, phone },
      true, // admin-initiated: skip deduplication
    )

    // Audit log
    await service.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_send_notification',
      resource: 'notifications',
      ip_address: request.headers.get('x-forwarded-for'),
      metadata: { member_id, type, title, channels },
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/notifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
