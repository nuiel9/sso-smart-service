import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatStream, calculateConfidence, CONFIDENCE_THRESHOLD } from '@/lib/ai/typhoon'
import { getRelevantContext } from '@/lib/ai/rag'
import type { TyphoonMessage } from '@/lib/ai/typhoon'

const RATE_LIMIT = 30 // messages per hour per user

// ---------------------------------------------------------------------------
// Rate limit check
// ---------------------------------------------------------------------------

async function isRateLimited(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Step 1: get all session IDs for this user
  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('member_id', userId)

  if (!sessions || sessions.length === 0) return false

  const sessionIds = sessions.map((s) => s.id)

  // Step 2: count user messages in those sessions over the last hour
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .in('session_id', sessionIds)
    .eq('role', 'user')
    .gte('created_at', oneHourAgo)

  return (count ?? 0) >= RATE_LIMIT
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()

function sseChunk(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Parse body
  let message: string
  let sessionId: string | null
  try {
    const body = await request.json()
    message = body.message
    sessionId = body.sessionId ?? null
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: 'message is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Rate limit
  if (await isRateLimited(user.id)) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', retryAfter: 3600 }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Fetch RAG context and chat history in parallel
  const [context, historyResult] = await Promise.all([
    getRelevantContext(message),
    sessionId
      ? supabase
          .from('chat_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: null }),
  ])

  const chatHistory: TyphoonMessage[] = (historyResult.data ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const allMessages: TyphoonMessage[] = [...chatHistory, { role: 'user', content: message }]

  // Create or reuse session (before streaming so sessionId is available in the done event)
  let currentSessionId = sessionId
  if (!currentSessionId) {
    const { data: session } = await supabase
      .from('chat_sessions')
      .insert({ member_id: user.id, channel: 'web' })
      .select('id')
      .single()
    currentSessionId = session?.id ?? null
  }

  // Build SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      let streamError: string | null = null

      try {
        for await (const chunk of chatStream(allMessages, context)) {
          fullContent += chunk
          controller.enqueue(sseChunk({ content: chunk }))
        }
      } catch (err) {
        streamError = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(sseChunk({ error: streamError }))
      }

      // Persist to DB after stream completes
      if (fullContent && currentSessionId) {
        const confidence = calculateConfidence(fullContent)
        const shouldEscalate = confidence < CONFIDENCE_THRESHOLD

        await Promise.allSettled([
          // Save user message
          supabase.from('chat_messages').insert({
            session_id: currentSessionId,
            role: 'user',
            content: message,
          }),
          // Save assistant message
          supabase.from('chat_messages').insert({
            session_id: currentSessionId,
            role: 'assistant',
            content: fullContent,
            confidence_score: confidence,
            escalated: shouldEscalate,
          }),
          // Audit log
          supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'CHAT_MESSAGE',
            resource: 'chat_session',
            ip_address: request.headers.get('x-forwarded-for'),
            user_agent: request.headers.get('user-agent'),
            metadata: {
              session_id: currentSessionId,
              confidence,
              escalated: shouldEscalate,
            },
          }),
        ])

        // Send done event with metadata
        controller.enqueue(
          sseChunk({
            done: true,
            sessionId: currentSessionId,
            confidence,
            shouldEscalate,
          })
        )
      } else if (!streamError) {
        controller.enqueue(sseChunk({ done: true, sessionId: currentSessionId }))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
