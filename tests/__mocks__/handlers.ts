import { http, HttpResponse } from 'msw'

// Mock API handlers for testing
export const handlers = [
  // Chat API
  http.post('/api/chat', async ({ request }) => {
    const body = await request.json() as { message: string }

    // Simulate streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const response = 'สวัสดีครับ ผมเป็น AI ผู้ช่วยของสำนักงานประกันสังคม'
        const chunks = response.split(' ')

        chunks.forEach((chunk, i) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk + ' ' })}\n\n`))
        })

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          done: true,
          sessionId: 'test-session',
          confidence: 0.85,
          shouldEscalate: false
        })}\n\n`))
        controller.close()
      },
    })

    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }),

  // Benefits API
  http.get('/api/benefits', () => {
    return HttpResponse.json({
      benefits: [
        {
          id: '1',
          member_id: 'test-user',
          benefit_type: 'illness',
          status: 'active',
          amount: 15000,
          expiry_date: '2025-12-31',
        },
        {
          id: '2',
          member_id: 'test-user',
          benefit_type: 'unemployment',
          status: 'active',
          amount: null,
          expiry_date: null,
        },
      ],
    })
  }),

  // Auth callback
  http.get('/api/auth/callback', ({ request }) => {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')

    if (!code) {
      return HttpResponse.redirect('/login?error=missing_code')
    }

    return HttpResponse.redirect('/member')
  }),

  // Typhoon LLM API (external)
  http.post('https://api.opentyphoon.ai/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'test-completion',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'สิทธิประโยชน์กรณีเจ็บป่วยตามกฎหมายประกันสังคม ครอบคลุมค่ารักษาพยาบาลและเงินทดแทนการขาดรายได้',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    })
  }),

  // Typhoon Embeddings API
  http.post('https://api.opentyphoon.ai/v1/embeddings', () => {
    return HttpResponse.json({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    })
  }),
]

// Additional handlers for specific test scenarios
export const errorHandlers = {
  rateLimited: http.post('/api/chat', () => {
    return HttpResponse.json(
      { error: 'rate_limited', retryAfter: 3600 },
      { status: 429 }
    )
  }),

  unauthorized: http.get('/api/benefits', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }),

  invalidOtp: http.post('/api/auth/verify-otp', () => {
    return HttpResponse.json(
      { error: 'Invalid OTP' },
      { status: 400 }
    )
  }),
}
