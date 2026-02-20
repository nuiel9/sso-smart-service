import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vercel Cron: runs weekly on Monday at 9 AM
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
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Find benefits expiring within 30 days
    const { data: expiringBenefits, error } = await supabase
      .from('benefits')
      .select('*, profiles!inner(id, full_name_th, phone)')
      .eq('status', 'active')
      .lte('expiry_date', thirtyDaysFromNow.toISOString())
      .gte('expiry_date', now.toISOString())

    if (error) throw error

    if (!expiringBenefits || expiringBenefits.length === 0) {
      return NextResponse.json({
        message: 'No expiring benefits found',
        count: 0,
      })
    }

    // Create notifications for each expiring benefit
    const notifications = expiringBenefits.map((benefit) => ({
      member_id: benefit.profiles.id,
      type: 'benefit_reminder' as const,
      title: 'สิทธิประโยชน์ใกล้หมดอายุ',
      body: `สิทธิ์ ${getBenefitTypeName(benefit.benefit_type)} ของคุณจะหมดอายุในวันที่ ${formatThaiDate(benefit.expiry_date)} กรุณาดำเนินการก่อนหมดอายุ`,
      channel: 'push' as const,
    }))

    // Insert notifications (avoiding duplicates)
    const { data: inserted, error: insertError } = await supabase
      .from('notifications')
      .upsert(notifications, {
        onConflict: 'member_id,type,title',
        ignoreDuplicates: true,
      })
      .select('id')

    if (insertError) throw insertError

    // Log cron execution
    await supabase.from('audit_logs').insert({
      action: 'cron_benefit_reminders',
      resource: 'benefits',
      metadata: {
        expiring_count: expiringBenefits.length,
        notifications_created: inserted?.length ?? 0,
      },
    })

    return NextResponse.json({
      message: 'Benefit reminders processed',
      expiring_count: expiringBenefits.length,
      notifications_created: inserted?.length ?? 0,
    })
  } catch (error) {
    console.error('Cron benefit-reminders error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

function getBenefitTypeName(type: string): string {
  const names: Record<string, string> = {
    illness: 'กรณีเจ็บป่วย',
    unemployment: 'กรณีว่างงาน',
    old_age: 'กรณีชราภาพ',
    maternity: 'กรณีคลอดบุตร',
    child_support: 'กรณีสงเคราะห์บุตร',
    death: 'กรณีเสียชีวิต',
    disability: 'กรณีทุพพลภาพ',
  }
  return names[type] || type
}

function formatThaiDate(dateStr: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'buddhist',
  }).format(new Date(dateStr))
}
