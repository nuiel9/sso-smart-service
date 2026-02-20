const TYPHOON_API_URL = 'https://api.opentyphoon.ai/v1/chat/completions'
const CONFIDENCE_THRESHOLD = 0.7
const TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

export interface TyphoonMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface StreamChunk {
  choices: {
    delta: { content?: string }
    finish_reason: string | null
  }[]
}

interface ChatResult {
  content: string
  confidence: number
  shouldEscalate: boolean
}

export const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยอัจฉริยะของสำนักงานประกันสังคม (สปส.) ประเทศไทย
หน้าที่ของคุณคือช่วยตอบคำถามเกี่ยวกับ:
- สิทธิประโยชน์ประกันสังคมมาตรา 33, 39 และ 40 (เจ็บป่วย, คลอดบุตร, ว่างงาน, ชราภาพ, เสียชีวิต, สงเคราะห์บุตร)
- การตรวจสอบสิทธิ์และสถานะ
- ขั้นตอนการยื่นขอรับสิทธิประโยชน์
- สถานที่และช่องทางติดต่อ สปส. (สายด่วน 1506)

กฎสำคัญ:
1. ตอบเป็นภาษาไทยเสมอ
2. ให้ข้อมูลที่ถูกต้องตามกฎหมายประกันสังคม
3. ถ้าไม่แน่ใจ ให้แนะนำติดต่อเจ้าหน้าที่โดยตรงหรือสายด่วน 1506
4. ปกป้องข้อมูลส่วนบุคคลของผู้ใช้เสมอ
5. ตอบสั้น กระชับ ได้ใจความ ไม่เกิน 3 ย่อหน้า`

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Streaming generator
// ---------------------------------------------------------------------------

/**
 * Streams tokens from Typhoon LLM one chunk at a time.
 * Retries up to MAX_RETRIES times with exponential backoff.
 * Times out after TIMEOUT_MS milliseconds.
 */
export async function* chatStream(
  messages: TyphoonMessage[],
  context?: string
): AsyncGenerator<string> {
  const systemMessage: TyphoonMessage = {
    role: 'system',
    content: context ? `${SYSTEM_PROMPT}\n\nข้อมูลเพิ่มเติม:\n${context}` : SYSTEM_PROMPT,
  }

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(500 * Math.pow(2, attempt - 1)) // 500ms, 1s, 2s
    }
    try {
      const response = await fetchWithTimeout(
        TYPHOON_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.TYPHOON_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'typhoon-v2.5-30b-a3b-instruct',
            messages: [systemMessage, ...messages],
            temperature: 0.3,
            max_tokens: 1024,
            stream: true,
          }),
        },
        TIMEOUT_MS
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Typhoon API error:', response.status, errorText)
        throw new Error(`Typhoon API error: ${response.status} - ${errorText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const chunk: StreamChunk = JSON.parse(trimmed.slice(6))
            const text = chunk.choices[0]?.delta?.content
            if (text) yield text
          } catch {
            // Malformed JSON chunk — skip
          }
        }
      }

      // Stream completed successfully — exit retry loop
      return
    } catch (err) {
      lastError = err
      const isAbort = err instanceof Error && err.name === 'AbortError'
      // Abort (timeout) on last attempt falls through to throw
      if (isAbort && attempt < MAX_RETRIES - 1) continue
      if (!isAbort && attempt < MAX_RETRIES - 1) continue
    }
  }

  throw lastError ?? new Error('chatStream failed after retries')
}

// ---------------------------------------------------------------------------
// Non-streaming helper (kept for backwards compat / tests)
// ---------------------------------------------------------------------------

export async function chat(
  messages: TyphoonMessage[],
  context?: string
): Promise<ChatResult> {
  let content = ''
  for await (const chunk of chatStream(messages, context)) {
    content += chunk
  }
  const confidence = calculateConfidence(content)
  return { content, confidence, shouldEscalate: confidence < CONFIDENCE_THRESHOLD }
}

// ---------------------------------------------------------------------------
// Confidence heuristic — exported so route.ts can use it directly
// ---------------------------------------------------------------------------

export function calculateConfidence(content: string): number {
  let confidence = 0.8

  const uncertaintyMarkers = [
    'ไม่แน่ใจ',
    'อาจจะ',
    'ควรสอบถาม',
    'ติดต่อเจ้าหน้าที่',
    'ไม่ทราบ',
    'ขอโทษ',
  ]
  for (const marker of uncertaintyMarkers) {
    if (content.includes(marker)) confidence -= 0.15
  }

  const certaintyMarkers = ['ตามกฎหมาย', 'สิทธิ์ที่ได้รับ', 'ขั้นตอน', 'เอกสารที่ต้องใช้']
  for (const marker of certaintyMarkers) {
    if (content.includes(marker)) confidence += 0.05
  }

  return Math.max(0, Math.min(1, confidence))
}

export { CONFIDENCE_THRESHOLD }
