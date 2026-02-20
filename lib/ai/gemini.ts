const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL = 'gemini-3-flash-preview' // Fast model
const CONFIDENCE_THRESHOLD = 0.7
const TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

export interface GeminiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GeminiStreamChunk {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
    }
    finishReason?: string
  }[]
}

interface ChatResult {
  content: string
  confidence: number
  shouldEscalate: boolean
}

export const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยอัจฉริยะของสำนักงานประกันสังคม (สปส.) ประเทศไทย
หน้าที่ของคุณคือช่วยตอบคำถามเกี่ยวกับสิทธิประโยชน์ประกันสังคมมาตรา 33, 39 และ 40

=== ข้อมูลสิทธิประโยชน์ที่สำคัญ ===

กรณีว่างงาน (มาตรา 33):
- เงื่อนไข: ส่งเงินสมทบมาแล้วไม่น้อยกว่า 6 เดือน ภายใน 15 เดือน
- ต้องขึ้นทะเบียนว่างงานกับกรมการจัดหางานภายใน 30 วันหลังออกจากงาน
- ฐานเงินเดือนสูงสุดในการคำนวณ: 15,000 บาท

อัตราเงินชดเชย:
• ถูกเลิกจ้าง/ไล่ออกโดยไม่มีความผิด: ได้รับ 50% ของค่าจ้าง ไม่เกิน 180 วัน (6 เดือน)
  - ตัวอย่าง: เงินเดือน 30,000 บาท → คิดจากฐาน 15,000 บาท → ได้รับ 7,500 บาท/เดือน
• ลาออกเอง/หมดสัญญาจ้าง: ได้รับ 30% ของค่าจ้าง ไม่เกิน 90 วัน (3 เดือน)
  - ตัวอย่าง: เงินเดือน 30,000 บาท → คิดจากฐาน 15,000 บาท → ได้รับ 4,500 บาท/เดือน

กรณีเจ็บป่วย:
- เงินทดแทนการขาดรายได้ 50% ของค่าจ้าง ไม่เกิน 90 วัน/ปี
- เงื่อนไข: ส่งสมทบครบ 3 เดือน ภายใน 15 เดือน

กรณีคลอดบุตร:
- ค่าคลอด 15,000 บาท + เงินสงเคราะห์ 50% ของค่าจ้าง 90 วัน
- เงื่อนไข: ส่งสมทบครบ 5 เดือน ภายใน 15 เดือน

กรณีสงเคราะห์บุตร:
- 800 บาท/เดือน/คน (ไม่เกิน 3 คน, อายุไม่เกิน 6 ปี)
- เงื่อนไข: ส่งสมทบครบ 12 เดือน ภายใน 36 เดือน

กรณีชราภาพ:
- บำนาญ: ส่งสมทบครบ 180 เดือน → 20% ของค่าจ้างเฉลี่ย 60 เดือนสุดท้าย
- บำเหน็จ: ส่งสมทบไม่ครบ 180 เดือน → คืนเงินสมทบพร้อมผลตอบแทน

=== กฎสำคัญ ===
1. ตอบเป็นภาษาไทยเสมอ
2. คำนวณจากฐานเงินเดือนสูงสุด 15,000 บาท เสมอ
3. ถ้าไม่แน่ใจ แนะนำโทร 1506
4. ตอบสั้น กระชับ ได้ใจความ`

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

// Convert our message format to Gemini's format
function convertToGeminiFormat(messages: GeminiMessage[], context?: string) {
  const systemInstruction = context
    ? `${SYSTEM_PROMPT}\n\nข้อมูลเพิ่มเติม:\n${context}`
    : SYSTEM_PROMPT

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  return {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  }
}

// ---------------------------------------------------------------------------
// Streaming generator
// ---------------------------------------------------------------------------

/**
 * Streams tokens from Google Gemini one chunk at a time.
 * Retries up to MAX_RETRIES times with exponential backoff.
 * Times out after TIMEOUT_MS milliseconds.
 */
export async function* chatStream(
  messages: GeminiMessage[],
  context?: string
): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`
  const body = convertToGeminiFormat(messages, context)

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(500 * Math.pow(2, attempt - 1)) // 500ms, 1s, 2s
    }
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        TIMEOUT_MS
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error:', response.status, errorText)
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
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
            const chunk: GeminiStreamChunk = JSON.parse(trimmed.slice(6))
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text
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
// Non-streaming helper
// ---------------------------------------------------------------------------

export async function chat(
  messages: GeminiMessage[],
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
// Confidence heuristic
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

// Re-export types for compatibility
export type TyphoonMessage = GeminiMessage
