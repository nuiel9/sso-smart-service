import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chat } from '@/lib/ai/typhoon'
import { getRelevantContext } from '@/lib/ai/rag'

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
    const { message, sessionId } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get relevant context from RAG
    const context = await getRelevantContext(message)

    // Get chat history if sessionId provided
    let chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
    if (sessionId) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(10)

      if (messages) {
        chatHistory = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      }
    }

    // Call Typhoon LLM
    const result = await chat(
      [...chatHistory, { role: 'user', content: message }],
      context
    )

    // Create or get session
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const { data: session } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, status: 'active' })
        .select('id')
        .single()

      currentSessionId = session?.id
    }

    // Save messages to database
    if (currentSessionId) {
      await supabase.from('chat_messages').insert([
        {
          session_id: currentSessionId,
          role: 'user',
          content: message,
        },
        {
          session_id: currentSessionId,
          role: 'assistant',
          content: result.content,
          confidence: result.confidence,
        },
      ])

      // If should escalate, update session status
      if (result.shouldEscalate) {
        await supabase
          .from('chat_sessions')
          .update({ status: 'escalated' })
          .eq('id', currentSessionId)
      }
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'CHAT_MESSAGE',
      resource_type: 'chat_session',
      resource_id: currentSessionId,
      details: {
        confidence: result.confidence,
        escalated: result.shouldEscalate,
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    })

    return NextResponse.json({
      response: result.content,
      confidence: result.confidence,
      shouldEscalate: result.shouldEscalate,
      sessionId: currentSessionId,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
