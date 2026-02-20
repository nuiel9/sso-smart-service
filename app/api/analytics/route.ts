import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface AnalyticsData {
  daily_users: {
    date: string
    count: number
  }[]
  popular_questions: {
    question: string
    count: number
  }[]
  escalation_rate: {
    total: number
    escalated: number
    rate: number
  }
  satisfaction_scores: {
    average: number
    total_responses: number
    distribution: Record<number, number>
  }
  benefits_overview: {
    type: string
    active: number
    pending: number
    claimed: number
  }[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get date range from query params
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch all analytics data in parallel
    const [
      dailyUsersResult,
      chatMessagesResult,
      satisfactionResult,
      benefitsResult,
    ] = await Promise.all([
      // Daily active users
      supabase.rpc('get_daily_active_users', {
        start_date: startDate.toISOString(),
      }),

      // Chat messages for popular questions and escalation rate
      supabase
        .from('chat_messages')
        .select('content, escalated, role')
        .eq('role', 'user')
        .gte('created_at', startDate.toISOString()),

      // Satisfaction scores
      supabase
        .from('chat_sessions')
        .select('satisfaction_score')
        .not('satisfaction_score', 'is', null)
        .gte('started_at', startDate.toISOString()),

      // Benefits overview
      supabase
        .from('benefits')
        .select('benefit_type, status'),
    ])

    // Process daily users
    const dailyUsers = dailyUsersResult.data || []

    // Process chat data
    const chatMessages = chatMessagesResult.data || []
    const totalMessages = chatMessages.length
    const escalatedMessages = chatMessages.filter((m) => m.escalated).length

    // Extract popular questions (simplified - in production use NLP)
    const questionCounts = new Map<string, number>()
    chatMessages.forEach((msg) => {
      const normalized = msg.content.slice(0, 50).toLowerCase()
      questionCounts.set(normalized, (questionCounts.get(normalized) || 0) + 1)
    })
    const popularQuestions = Array.from(questionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }))

    // Process satisfaction scores
    const scores = satisfactionResult.data || []
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let totalScore = 0
    scores.forEach((s) => {
      if (s.satisfaction_score && s.satisfaction_score >= 1 && s.satisfaction_score <= 5) {
        distribution[s.satisfaction_score]++
        totalScore += s.satisfaction_score
      }
    })

    // Process benefits
    const benefits = benefitsResult.data || []
    const benefitsMap = new Map<string, { active: number; pending: number; claimed: number }>()
    benefits.forEach((b) => {
      const current = benefitsMap.get(b.benefit_type) || { active: 0, pending: 0, claimed: 0 }
      if (b.status === 'active') current.active++
      else if (b.status === 'pending') current.pending++
      else if (b.status === 'claimed') current.claimed++
      benefitsMap.set(b.benefit_type, current)
    })

    const analytics: AnalyticsData = {
      daily_users: dailyUsers.map((d: { date: string; count: number }) => ({
        date: d.date,
        count: d.count,
      })),
      popular_questions: popularQuestions,
      escalation_rate: {
        total: totalMessages,
        escalated: escalatedMessages,
        rate: totalMessages > 0 ? (escalatedMessages / totalMessages) * 100 : 0,
      },
      satisfaction_scores: {
        average: scores.length > 0 ? totalScore / scores.length : 0,
        total_responses: scores.length,
        distribution,
      },
      benefits_overview: Array.from(benefitsMap.entries()).map(([type, counts]) => ({
        type,
        ...counts,
      })),
    }

    // Log analytics access
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'view_analytics',
      resource: 'analytics',
      metadata: { days },
    })

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
