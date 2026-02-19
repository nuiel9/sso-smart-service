import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's benefits
    const { data: benefits, error } = await supabase
      .from('benefits')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })

    if (error) {
      throw error
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'VIEW_BENEFITS',
      resource_type: 'benefits',
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    })

    return NextResponse.json({ benefits })
  } catch (error) {
    console.error('Benefits API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { benefit_type, amount } = body

    if (!benefit_type || !amount) {
      return NextResponse.json(
        { error: 'Benefit type and amount are required' },
        { status: 400 }
      )
    }

    // Create benefit request
    const { data: benefit, error } = await supabase
      .from('benefits')
      .insert({
        user_id: user.id,
        benefit_type,
        amount,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'REQUEST_BENEFIT',
      resource_type: 'benefits',
      resource_id: benefit.id,
      details: { benefit_type, amount },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    })

    return NextResponse.json({ benefit })
  } catch (error) {
    console.error('Benefits API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
