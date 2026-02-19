import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditAction, getDashboardPath } from '@/lib/supabase/auth'
import type { UserRole } from '@/lib/types/database'

/**
 * Supabase Auth Callback Handler
 *
 * เรียกโดย Supabase หลัง OAuth login (Google, LINE ฯลฯ)
 * แลก authorization code เป็น session และ redirect ไปหน้า dashboard ตาม role
 *
 * URL: /api/auth/callback?code=xxx&next=/member/benefits
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // ตรวจสอบ next param — ป้องกัน open redirect โดยรับเฉพาะ relative paths
  const rawNext = searchParams.get('next') ?? ''
  const safeNext =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()

  // แลก authorization code เป็น session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] exchangeCodeForSession error:', error?.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  const user = data.user

  // ดึง role เพื่อ redirect ไป dashboard ที่ถูกต้อง
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'member') as UserRole

  // Audit log: บันทึกการ login ผ่าน OAuth
  await logAuditAction({
    userId: user.id,
    action: 'login',
    resource: 'auth',
    metadata: {
      method: 'oauth_callback',
      provider: user.app_metadata?.provider ?? 'unknown',
    },
    userAgent: request.headers.get('user-agent'),
  })

  // Redirect ไป: safeNext (ถ้ามี) หรือ dashboard ตาม role
  const destination = safeNext ?? getDashboardPath(role)
  return NextResponse.redirect(`${origin}${destination}`)
}
