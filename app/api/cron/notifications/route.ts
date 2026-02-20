import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vercel Cron: runs daily at 8 AM
export const runtime = 'nodejs'
export const maxDuration = 60

interface NotificationResult {
  sent: number
  failed: number
  errors: string[]
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: NotificationResult = {
    sent: 0,
    failed: 0,
    errors: [],
  }

  try {
    const supabase = await createClient()

    // Get pending notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*, profiles!inner(phone, line_user_id)')
      .eq('read', false)
      .is('sent_at', null)
      .limit(100)

    if (error) throw error

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({
        message: 'No pending notifications',
        ...result,
      })
    }

    // Process each notification
    for (const notification of notifications) {
      try {
        // Send via appropriate channel
        if (notification.channel === 'line' && notification.profiles?.line_user_id) {
          await sendLineNotification(
            notification.profiles.line_user_id,
            notification.title,
            notification.body
          )
        } else if (notification.channel === 'sms' && notification.profiles?.phone) {
          await sendSmsNotification(
            notification.profiles.phone,
            `${notification.title}: ${notification.body}`
          )
        }

        // Mark as sent
        await supabase
          .from('notifications')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', notification.id)

        result.sent++
      } catch (err) {
        result.failed++
        result.errors.push(`Failed to send ${notification.id}: ${err}`)
      }
    }

    // Log cron execution
    await supabase.from('audit_logs').insert({
      action: 'cron_notifications',
      resource: 'notifications',
      metadata: result,
    })

    return NextResponse.json({
      message: 'Notifications processed',
      ...result,
    })
  } catch (error) {
    console.error('Cron notifications error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

async function sendLineNotification(userId: string, title: string, body: string) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        {
          type: 'text',
          text: `📢 ${title}\n\n${body}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`LINE API error: ${response.status}`)
  }
}

async function sendSmsNotification(phone: string, message: string) {
  // Placeholder for SMS provider integration
  // In production, integrate with Thai SMS provider (e.g., ThaiSMS, SMSMKT)
  console.log(`[SMS] To: ${phone}, Message: ${message}`)
}
