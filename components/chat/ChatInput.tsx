'use client'

import { useState, KeyboardEvent, useRef } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const QUICK_REPLIES = ['ตรวจสอบสิทธิ์', 'สถานะเงิน', 'ติดต่อเจ้าหน้าที่']
const MAX_CHARS = 500
const CHAR_WARN_AT = 400

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = message.trim()
    if (trimmed && !disabled && trimmed.length <= MAX_CHARS) {
      onSend(trimmed)
      setMessage('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickReply = (text: string) => {
    if (!disabled) {
      onSend(text)
    }
  }

  const charsLeft = MAX_CHARS - message.length
  const showCounter = message.length >= CHAR_WARN_AT

  return (
    <div className="space-y-2">
      {/* Quick reply chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            onClick={() => handleQuickReply(reply)}
            disabled={disabled}
            className="text-xs px-3 py-1 rounded-full border border-[#1e3a5f]/30 text-[#1e3a5f] bg-white hover:bg-[#1e3a5f]/5 active:bg-[#1e3a5f]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์ข้อความ..."
            disabled={disabled}
            className="pr-12"
            aria-label="ข้อความ"
          />
          {showCounter && (
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${
                charsLeft <= 20 ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {charsLeft}
            </span>
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim() || message.length > MAX_CHARS}
          size="icon"
          className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 shrink-0"
          aria-label="ส่ง"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
