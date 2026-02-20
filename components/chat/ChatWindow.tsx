'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChatMessage, Message } from './ChatMessage'
import { ChatInput } from './ChatInput'

// ---------------------------------------------------------------------------
// SSE event shape from /api/chat
// ---------------------------------------------------------------------------
interface SSEContent { content: string }
interface SSEDone { done: true; sessionId?: string; confidence?: number; shouldEscalate?: boolean }
interface SSEError { error: string }
type SSEEvent = SSEContent | SSEDone | SSEError

const STREAMING_ID = 'assistant-streaming'

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content: 'สวัสดีครับ ผมเป็น AI ผู้ช่วยของสำนักงานประกันสังคม มีอะไรให้ช่วยไหมครับ?',
  timestamp: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [rateLimitError, setRateLimitError] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    // Scroll within chat container only, not the whole page
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return

      setRateLimitError(false)

      // Add user message immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)

      // Add streaming placeholder
      const streamingPlaceholder: Message = {
        id: STREAMING_ID,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }
      setMessages((prev) => [...prev, streamingPlaceholder])

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, sessionId }),
        })

        if (response.status === 429) {
          setRateLimitError(true)
          setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID))
          return
        }

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        // Read SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalConfidence: number | undefined
        let finalShouldEscalate: boolean | undefined

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue

            let event: SSEEvent
            try {
              event = JSON.parse(trimmed.slice(6))
            } catch {
              continue
            }

            if ('content' in event) {
              // Append token to streaming placeholder
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === STREAMING_ID
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              )
            } else if ('done' in event && event.done) {
              if (event.sessionId && !sessionId) setSessionId(event.sessionId)
              finalConfidence = event.confidence
              finalShouldEscalate = event.shouldEscalate
            } else if ('error' in event) {
              throw new Error(event.error)
            }
          }
        }

        // Finalise: replace streaming placeholder with permanent message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === STREAMING_ID
              ? {
                  ...m,
                  id: `assistant-${Date.now()}`,
                  isStreaming: false,
                  confidence: finalConfidence,
                  isEscalated: finalShouldEscalate,
                }
              : m
          )
        )
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === STREAMING_ID
              ? {
                  ...m,
                  id: `assistant-error-${Date.now()}`,
                  content: 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
                  isStreaming: false,
                }
              : m
          )
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, sessionId]
  )

  return (
    <Card className="flex flex-col h-[560px] shadow-md">
      {/* Header */}
      <CardHeader className="py-3 px-4 border-b shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-[#1e3a5f]">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          AI ผู้ช่วยประกันสังคม
          <span className="ml-auto text-[10px] font-normal text-gray-400">สปส.</span>
        </CardTitle>
      </CardHeader>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Typing indicator — shown only when streaming placeholder has no content yet */}
        {isStreaming &&
          messages.find((m) => m.id === STREAMING_ID)?.content === '' && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-xs">
                🤖
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

        {/* Rate limit error */}
        {rateLimitError && (
          <div className="flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
            <span>
              คุณส่งข้อความครบ 30 ครั้งในชั่วโมงนี้แล้ว กรุณารอ 1 ชั่วโมงก่อนส่งอีกครั้ง
              หรือโทร&nbsp;
              <a href="tel:1506" className="font-semibold underline">
                1506
              </a>
            </span>
          </div>
        )}
      </div>

      {/* Footer: input + disclaimer */}
      <div className="border-t px-4 py-3 space-y-2 shrink-0">
        <ChatInput onSend={handleSendMessage} disabled={isStreaming || rateLimitError} />
        <p className="text-[10px] text-gray-400 text-center leading-snug">
          ⚠️ AI อาจตอบผิดได้ กรุณาตรวจสอบข้อมูลกับ สปส. โดยตรงหรือสายด่วน&nbsp;
          <a href="tel:1506" className="underline">
            1506
          </a>
        </p>
      </div>
    </Card>
  )
}
