'use client'

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const RESEND_COOLDOWN_SEC = 60

interface OTPInputProps {
  length?: number
  onComplete: (otp: string) => void
  /** เรียกเมื่อผู้ใช้กด "ขอรหัสใหม่" — ควร throw หากส่ง OTP ไม่สำเร็จ */
  onResend: () => Promise<void>
  disabled?: boolean
}

export function OTPInput({
  length = 6,
  onComplete,
  onResend,
  disabled,
}: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''))
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SEC)
  const [isResending, setIsResending] = useState(false)
  const [resendError, setResendError] = useState('')
  const [resendSuccess, setResendSuccess] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus กล่องแรกเมื่อ mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Countdown timer — นับถอยหลังจาก RESEND_COOLDOWN_SEC → 0
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newValues = [...values]
    newValues[index] = value.slice(-1)
    setValues(newValues)

    // เลื่อนไปช่องถัดไปอัตโนมัติ
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // ตรวจสอบว่าครบ 6 หลักหรือยัง
    if (newValues.every((v) => v !== '') && newValues.join('').length === length) {
      onComplete(newValues.join(''))
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!values[index] && index > 0) {
        // ถ้าช่องนี้ว่าง → ลบช่องก่อนหน้าและย้าย focus
        const newValues = [...values]
        newValues[index - 1] = ''
        setValues(newValues)
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    // รองรับการ paste OTP ที่มาจาก SMS (เช่น "123456" หรือ "OTP: 123456")
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return

    const newValues = [...values]
    digits.split('').forEach((char, i) => {
      if (i < length) newValues[i] = char
    })
    setValues(newValues)

    const nextFocus = Math.min(digits.length, length - 1)
    inputRefs.current[nextFocus]?.focus()

    if (digits.length === length) {
      onComplete(digits)
    }
  }

  // Resend OTP — reset countdown และ clear ช่อง OTP
  const handleResend = useCallback(async () => {
    setResendError('')
    setResendSuccess(false)
    setIsResending(true)
    try {
      await onResend()
      // Reset state หลัง resend สำเร็จ
      setValues(Array(length).fill(''))
      setCountdown(RESEND_COOLDOWN_SEC)
      setResendSuccess(true)
      inputRefs.current[0]?.focus()
    } catch {
      setResendError('ไม่สามารถส่ง OTP ใหม่ได้ กรุณาลองใหม่')
    } finally {
      setIsResending(false)
    }
  }, [onResend, length])

  const isInputDisabled = disabled || isResending

  return (
    <div className="space-y-4">
      {/* OTP Boxes */}
      <div className="flex justify-center gap-2" role="group" aria-label="กรอกรหัส OTP 6 หลัก">
        {values.map((value, index) => (
          <Input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={isInputDisabled}
            className="w-12 h-14 text-center text-2xl font-bold tracking-widest"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`หลักที่ ${index + 1}`}
          />
        ))}
      </div>

      {/* Countdown / Resend */}
      <div className="text-center space-y-1">
        {countdown > 0 ? (
          <p className="text-sm text-gray-500">
            ส่งรหัสใหม่ได้ในอีก{' '}
            <span className="font-semibold text-blue-700 tabular-nums w-6 inline-block">
              {countdown}
            </span>{' '}
            วินาที
          </p>
        ) : (
          <Button
            type="button"
            variant="link"
            className="text-blue-600 p-0 h-auto text-sm font-medium"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                กำลังส่ง OTP ใหม่...
              </span>
            ) : (
              'ขอรหัส OTP ใหม่'
            )}
          </Button>
        )}

        {resendSuccess && !resendError && (
          <p className="text-xs text-green-600">ส่งรหัส OTP ใหม่แล้ว กรุณาตรวจสอบ SMS</p>
        )}
        {resendError && (
          <p className="text-xs text-red-500">{resendError}</p>
        )}
      </div>
    </div>
  )
}
