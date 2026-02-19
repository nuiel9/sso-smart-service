const TYPHOON_API_URL = 'https://api.opentyphoon.ai/v1/chat/completions'
const CONFIDENCE_THRESHOLD = 0.7

interface TyphoonMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface TyphoonResponse {
  id: string
  choices: {
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface ChatResult {
  content: string
  confidence: number
  shouldEscalate: boolean
}

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยอัจฉริยะของสำนักงานประกันสังคม (สปส.) ประเทศไทย
หน้าที่ของคุณคือช่วยตอบคำถามเกี่ยวกับ:
- สิทธิประโยชน์ประกันสังคม (เจ็บป่วย, คลอดบุตร, ว่างงาน, ชราภาพ, เสียชีวิต, สงเคราะห์บุตร)
- การตรวจสอบสิทธิ์และสถานะ
- ขั้นตอนการยื่นขอรับสิทธิประโยชน์
- สถานที่และช่องทางติดต่อ สปส.

กฎสำคัญ:
1. ตอบเป็นภาษาไทยเสมอ
2. ให้ข้อมูลที่ถูกต้องตามกฎหมายประกันสังคม
3. ถ้าไม่แน่ใจ ให้แนะนำติดต่อเจ้าหน้าที่โดยตรง
4. ปกป้องข้อมูลส่วนบุคคลของผู้ใช้เสมอ
5. ตอบสั้น กระชับ ได้ใจความ`

export async function chat(
  messages: TyphoonMessage[],
  context?: string
): Promise<ChatResult> {
  const systemMessage: TyphoonMessage = {
    role: 'system',
    content: context ? `${SYSTEM_PROMPT}\n\nข้อมูลเพิ่มเติม:\n${context}` : SYSTEM_PROMPT,
  }

  const response = await fetch(TYPHOON_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TYPHOON_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'typhoon-v2-70b-instruct',
      messages: [systemMessage, ...messages],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    throw new Error(`Typhoon API error: ${response.status}`)
  }

  const data: TyphoonResponse = await response.json()
  const content = data.choices[0]?.message?.content || ''

  // Calculate confidence based on response characteristics
  const confidence = calculateConfidence(content)
  const shouldEscalate = confidence < CONFIDENCE_THRESHOLD

  return {
    content,
    confidence,
    shouldEscalate,
  }
}

function calculateConfidence(content: string): number {
  // Simple heuristic-based confidence calculation
  let confidence = 0.8

  // Lower confidence if response contains uncertainty markers
  const uncertaintyMarkers = [
    'ไม่แน่ใจ',
    'อาจจะ',
    'ควรสอบถาม',
    'ติดต่อเจ้าหน้าที่',
    'ไม่ทราบ',
    'ขอโทษ',
  ]

  for (const marker of uncertaintyMarkers) {
    if (content.includes(marker)) {
      confidence -= 0.15
    }
  }

  // Higher confidence for specific information
  const certaintyMarkers = [
    'ตามกฎหมาย',
    'สิทธิ์ที่ได้รับ',
    'ขั้นตอน',
    'เอกสารที่ต้องใช้',
  ]

  for (const marker of certaintyMarkers) {
    if (content.includes(marker)) {
      confidence += 0.05
    }
  }

  return Math.max(0, Math.min(1, confidence))
}

export { CONFIDENCE_THRESHOLD }
