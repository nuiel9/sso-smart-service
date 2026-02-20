/**
 * POST /api/member/consent
 * บันทึก audit log สำหรับ PDPA consent action
 * เรียกจาก ConsentForm หลัง Supabase update สำเร็จ
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit, logAuditFromRequest, AuditAction } from '@/lib/audit/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items, action } = body as {
      items: Record<string, boolean>
      action: 'grant' | 'update' | 'revoke'
    }

    await logAuditFromRequest(request, {
      userId: user.id,
      action:
        action === 'revoke'
          ? AuditAction.PDPA_CONSENT_REVOKED
          : AuditAction.PDPA_CONSENT_GRANTED,
      resource: 'profiles',
      metadata: {
        consent_action: action,
        consent_items: items,
        consented_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/member/consent]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
