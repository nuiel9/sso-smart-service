'use client'

import { Badge } from '@/components/ui/badge'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'officer'
  content: string
  timestamp: Date
  confidence?: number
  isEscalated?: boolean
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isOfficer = message.role === 'officer'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : isOfficer
            ? 'bg-green-100 border border-green-300'
            : 'bg-gray-100'
        }`}
      >
        {isOfficer && (
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs bg-green-50">
              เจ้าหน้าที่
            </Badge>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <div className="flex items-center justify-between mt-1 gap-2">
          <span
            className={`text-xs ${
              isUser ? 'text-blue-200' : 'text-gray-400'
            }`}
          >
            {message.timestamp.toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.isEscalated && (
            <Badge variant="secondary" className="text-xs">
              ส่งต่อเจ้าหน้าที่
            </Badge>
          )}
          {message.confidence !== undefined && message.confidence < 0.7 && (
            <Badge variant="outline" className="text-xs text-orange-600">
              ความมั่นใจต่ำ
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
