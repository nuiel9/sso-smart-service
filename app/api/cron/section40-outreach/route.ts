import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vercel Cron: runs monthly on 1st at 10 AM
// ส่งข้อความ Outreach ให้กลุ่มเป้าหมายมาตรา 40
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Find potential Section 40 candidates:
    // - Not currently in Section 33/39/40
    // - Have phone number
    // - Haven't received outreach this month
    const { data: candidates, error } = await supabase
      .from('profiles')
      .select('id, full_name_th, phone')
      .is('section_type', null)
      .not('phone', 'is', null)
      .limit(500)

    if (error) throw error

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        message: 'No candidates for Section 40 outreach',
        count: 0,
      })
    }

    // Check who already received outreach this month
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)

    const { data: recentOutreach } = await supabase
      .from('notifications')
      .select('member_id')
      .eq('type', 'section40_outreach')
      .gte('sent_at', thisMonth.toISOString())

    const recentIds = new Set(recentOutreach?.map((n) => n.member_id) ?? [])
    const newCandidates = candidates.filter((c) => !recentIds.has(c.id))

    if (newCandidates.length === 0) {
      return NextResponse.json({
        message: 'All candidates already contacted this month',
        count: 0,
      })
    }

    // Create outreach notifications
    const notifications = newCandidates.map((candidate) => ({
      member_id: candidate.id,
      type: 'section40_outreach' as const,
      title: 'คุณรู้จักประกันสังคมมาตรา 40 หรือยัง?',
      body: `สวัสดีคุณ${candidate.full_name_th ?? ''} ประกันสังคมมาตรา 40 คุ้มครองผู้ประกอบอาชีพอิสระ เริ่มต้นเพียง 70-300 บาท/เดือน รับสิทธิประโยชน์ 3-5 กรณี สนใจสมัครได้ที่ สปส. ทุกสาขา หรือโทร 1506`,
      channel: 'push' as const,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id')

    if (insertError) throw insertError

    // Log cron execution
    await supabase.from('audit_logs').insert({
      action: 'cron_section40_outreach',
      resource: 'notifications',
      metadata: {
        candidates_total: candidates.length,
        candidates_new: newCandidates.length,
        notifications_created: inserted?.length ?? 0,
      },
    })

    return NextResponse.json({
      message: 'Section 40 outreach processed',
      candidates_total: candidates.length,
      candidates_new: newCandidates.length,
      notifications_created: inserted?.length ?? 0,
    })
  } catch (error) {
    console.error('Cron section40-outreach error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
