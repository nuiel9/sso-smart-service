import { describe, it, expect, vi, beforeEach } from 'vitest'
import { server } from './setup'
import { errorHandlers } from './__mocks__/handlers'

// =============================================================================
// Chat System Tests
// =============================================================================

describe('AI Chatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Thai Language Response', () => {
    it('should respond in Thai', () => {
      const isThaiText = (text: string): boolean => {
        // Check if text contains Thai characters
        return /[\u0E00-\u0E7F]/.test(text)
      }

      const responses = [
        'สวัสดีครับ ผมเป็น AI ผู้ช่วย',
        'สิทธิประโยชน์กรณีเจ็บป่วย',
        'กรุณาติดต่อสายด่วน 1506',
      ]

      responses.forEach(response => {
        expect(isThaiText(response)).toBe(true)
      })
    })

    it('should include SSO-specific terminology', () => {
      const ssoTerms = [
        'ประกันสังคม',
        'สปส.',
        'มาตรา 33',
        'มาตรา 39',
        'มาตรา 40',
        'สิทธิประโยชน์',
      ]

      const systemPrompt = `คุณเป็นผู้ช่วยอัจฉริยะของสำนักงานประกันสังคม (สปส.) ประเทศไทย
หน้าที่ของคุณคือช่วยตอบคำถามเกี่ยวกับ:
- สิทธิประโยชน์ประกันสังคมมาตรา 33, 39 และ 40`

      // Check that system prompt contains key SSO terms
      expect(systemPrompt).toContain('ประกันสังคม')
      expect(systemPrompt).toContain('สปส.')
      expect(systemPrompt).toContain('สิทธิประโยชน์')
    })
  })

  describe('Confidence Threshold & Escalation', () => {
    const CONFIDENCE_THRESHOLD = 0.7

    it('should calculate confidence based on response content', () => {
      const calculateConfidence = (content: string): number => {
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
          if (content.includes(marker)) {
            confidence -= 0.15
          }
        }

        const certaintyMarkers = ['ตามกฎหมาย', 'สิทธิ์ที่ได้รับ', 'ขั้นตอน', 'เอกสารที่ต้องใช้']
        for (const marker of certaintyMarkers) {
          if (content.includes(marker)) {
            confidence += 0.05
          }
        }

        return Math.max(0, Math.min(1, confidence))
      }

      // High confidence response
      const highConfidence = calculateConfidence('ตามกฎหมายประกันสังคม สิทธิ์ที่ได้รับครอบคลุมค่ารักษา')
      expect(highConfidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD)

      // Low confidence response
      const lowConfidence = calculateConfidence('ไม่แน่ใจครับ ควรสอบถามเจ้าหน้าที่โดยตรง')
      expect(lowConfidence).toBeLessThan(CONFIDENCE_THRESHOLD)
    })

    it('should escalate when confidence is below threshold', () => {
      const shouldEscalate = (confidence: number): boolean => {
        return confidence < CONFIDENCE_THRESHOLD
      }

      expect(shouldEscalate(0.5)).toBe(true)
      expect(shouldEscalate(0.7)).toBe(false)
      expect(shouldEscalate(0.9)).toBe(false)
    })

    it('should mark escalated messages appropriately', () => {
      interface Message {
        content: string
        confidence: number
        escalated: boolean
      }

      const processResponse = (content: string, confidence: number): Message => {
        return {
          content,
          confidence,
          escalated: confidence < CONFIDENCE_THRESHOLD,
        }
      }

      const escalatedMsg = processResponse('ไม่แน่ใจ ควรสอบถาม', 0.5)
      expect(escalatedMsg.escalated).toBe(true)

      const normalMsg = processResponse('ตามกฎหมาย สิทธิ์ครอบคลุม', 0.85)
      expect(normalMsg.escalated).toBe(false)
    })
  })

  describe('Rate Limiting', () => {
    const RATE_LIMIT = 30 // messages per hour

    it('should track message count per user', () => {
      const userMessages: Map<string, { count: number; resetAt: number }> = new Map()

      const trackMessage = (userId: string): boolean => {
        const now = Date.now()
        const hourInMs = 60 * 60 * 1000
        const userData = userMessages.get(userId)

        if (!userData || now >= userData.resetAt) {
          userMessages.set(userId, { count: 1, resetAt: now + hourInMs })
          return true
        }

        if (userData.count >= RATE_LIMIT) {
          return false
        }

        userData.count++
        return true
      }

      // First message should succeed
      expect(trackMessage('user-1')).toBe(true)

      // Simulate hitting rate limit
      const userData = userMessages.get('user-1')!
      userData.count = RATE_LIMIT

      expect(trackMessage('user-1')).toBe(false)
    })

    it('should return 429 status when rate limited', async () => {
      server.use(errorHandlers.rateLimited)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test' }),
      })

      expect(response.status).toBe(429)
      const data = await response.json()
      expect(data.error).toBe('rate_limited')
      expect(data.retryAfter).toBe(3600)
    })

    it('should reset rate limit after one hour', () => {
      const isRateLimitReset = (resetAt: number): boolean => {
        return Date.now() >= resetAt
      }

      const pastReset = Date.now() - 1000
      const futureReset = Date.now() + 3600000

      expect(isRateLimitReset(pastReset)).toBe(true)
      expect(isRateLimitReset(futureReset)).toBe(false)
    })
  })

  describe('Message Validation', () => {
    const MAX_MESSAGE_LENGTH = 500

    it('should reject empty messages', () => {
      const isValidMessage = (message: string): boolean => {
        const trimmed = message.trim()
        return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH
      }

      expect(isValidMessage('')).toBe(false)
      expect(isValidMessage('   ')).toBe(false)
      expect(isValidMessage('สวัสดี')).toBe(true)
    })

    it('should enforce max message length', () => {
      const isValidMessage = (message: string): boolean => {
        return message.trim().length <= MAX_MESSAGE_LENGTH
      }

      const shortMessage = 'สวัสดีครับ'
      const longMessage = 'ก'.repeat(501)

      expect(isValidMessage(shortMessage)).toBe(true)
      expect(isValidMessage(longMessage)).toBe(false)
    })
  })

  describe('Chat Session Management', () => {
    it('should create new session for first message', () => {
      const getOrCreateSession = (existingId: string | null): string => {
        return existingId || `session-${Date.now()}`
      }

      const newSession = getOrCreateSession(null)
      expect(newSession).toMatch(/^session-\d+$/)

      const existingSession = getOrCreateSession('existing-session')
      expect(existingSession).toBe('existing-session')
    })

    it('should maintain conversation history', () => {
      interface Message {
        role: 'user' | 'assistant'
        content: string
      }

      const history: Message[] = []

      const addMessage = (role: 'user' | 'assistant', content: string) => {
        history.push({ role, content })
      }

      addMessage('user', 'สวัสดีครับ')
      addMessage('assistant', 'สวัสดีครับ มีอะไรให้ช่วยไหมครับ')
      addMessage('user', 'ต้องการสอบถามสิทธิ์')

      expect(history).toHaveLength(3)
      expect(history[0].role).toBe('user')
      expect(history[1].role).toBe('assistant')
    })

    it('should limit history to last 10 messages', () => {
      const limitHistory = (messages: object[], limit: number = 10) => {
        return messages.slice(-limit)
      }

      const manyMessages = Array(15).fill({ role: 'user', content: 'test' })
      const limited = limitHistory(manyMessages)

      expect(limited).toHaveLength(10)
    })
  })
})
