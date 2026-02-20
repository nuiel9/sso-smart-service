'use client'

import { Badge } from '@/components/ui/badge'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'officer'
  content: string
  /** Accepts Date objects or ISO strings (safe to pass from SSE stream) */
  timestamp: Date | string
  confidence?: number
  isEscalated?: boolean
  /** Shows blinking cursor at the end while the SSE stream is in progress */
  isStreaming?: boolean
}

interface ChatMessageProps {
  message: Message
}

function formatTime(ts: Date | string): string {
  const date = typeof ts === 'string' ? new Date(ts) : ts
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isOfficer = message.role === 'officer'

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* AI / officer avatar */}
      {!isUser && (
        <div
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${
            isOfficer ? 'bg-green-100' : 'bg-[#1e3a5f]/10'
          }`}
          aria-hidden
        >
          {isOfficer ? '👤' : '🤖'}
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-[#1e3a5f] text-white rounded-br-sm'
            : isOfficer
            ? 'bg-green-50 border border-green-200 rounded-bl-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        }`}
      >
        {isOfficer && (
          <div className="mb-1">
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 bg-green-50 border-green-300 text-green-700"
            >
              เจ้าหน้าที่
            </Badge>
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
          {message.isStreaming && (
            <span
              className="inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom bg-current animate-pulse"
              aria-hidden
            />
          )}
        </p>

        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-[11px] ${isUser ? 'text-white/60' : 'text-gray-400'}`}
            suppressHydrationWarning
          >
            {formatTime(message.timestamp)}
          </span>
          {message.isEscalated && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              ส่งต่อเจ้าหน้าที่
            </Badge>
          )}
          {message.confidence !== undefined &&
            message.confidence < 0.7 &&
            !message.isStreaming && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 text-orange-600 border-orange-300"
              >
                ตรวจสอบข้อมูลอีกครั้ง
              </Badge>
            )}
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-semibold">
          คุณ
        </div>
      )}
    </div>
  )
}
