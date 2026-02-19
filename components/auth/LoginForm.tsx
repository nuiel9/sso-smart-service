'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OTPInput } from './OTPInput'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types/database'

// =============================================================================
// Helpers
// =============================================================================

/** ลบ non-digit และจำกัด 10 หลัก */
function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10)
}

/** ตรวจสอบเบอร์มือถือไทย: 06x, 08x, 09x — 10 หลัก */
function validateThaiPhone(phone: string): string | null {
  if (phone.length < 10) return 'กรุณากรอกเบอร์โทรให้ครบ 10 หลัก'
  if (!/^0[6-9]\d{8}$/.test(phone))
    return 'เบอร์โทรไม่ถูกต้อง (ต้องขึ้นต้นด้วย 06, 08 หรือ 09)'
  return null
}

/** แปลงเบอร์ไทยเป็น E.164 (+66XXXXXXXXX) */
function toE164(phone: string): string {
  return `+66${phone.slice(1)}` // 0812345678 → +66812345678
}

/** Mask เบอร์เพื่อแสดงผล: 081xxx5678 */
function maskPhone(phone: string): string {
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}xxx${phone.slice(-4)}`
}

/** Dashboard path ตาม role */
function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'officer': return '/officer'
    default: return '/member'
  }
}

type Step = 'phone' | 'otp'

// =============================================================================
// Component
// =============================================================================

export function LoginForm() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [pdpaConsent, setPdpaConsent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const searchParams = useSearchParams()
  // next param จาก middleware เมื่อ user ถูก redirect มาจาก protected route
  const nextPath = searchParams.get('next')

  // ---------------------------------------------------------------------------
  // Step 1: ขอ OTP
  // ---------------------------------------------------------------------------
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!pdpaConsent) {
      setError('กรุณายินยอมนโยบายความเป็นส่วนตัวก่อนดำเนินการต่อ')
      return
    }

    const phoneError = validateThaiPhone(phone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: toE164(phone),
        options: { channel: 'sms' },
      })
      if (otpError) throw otpError
      setStep('otp')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('rate') || msg.includes('too many')) {
        setError('ส่ง OTP บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่')
      } else if (msg.includes('invalid phone')) {
        setError('เบอร์โทรศัพท์ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
      } else {
        setError('ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Resend OTP (เรียกจาก OTPInput countdown)
  // ---------------------------------------------------------------------------
  const handleResendOTP = useCallback(async () => {
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: toE164(phone),
      options: { channel: 'sms' },
    })
    if (otpError) throw otpError
  }, [phone])

  // ---------------------------------------------------------------------------
  // Step 2: ยืนยัน OTP + PDPA update + Audit log + Role redirect
  // ---------------------------------------------------------------------------
  const handleOTPComplete = async (otp: string) => {
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: toE164(phone),
        token: otp,
        type: 'sms',
      })
      if (verifyError) throw verifyError

      const user = data.user
      if (!user) throw new Error('NO_USER')

      // อัปเดต pdpa_consent เฉพาะเมื่อยังไม่เคยยินยอม
      // Trigger on_pdpa_consent_change จะจัดการ audit log + timestamp ให้
      if (pdpaConsent) {
        await supabase
          .from('profiles')
          .update({ pdpa_consent: true })
          .eq('id', user.id)
          .eq('pdpa_consent', false)
      }

      // Audit log: บันทึกการ login (ตาม PDPA requirement)
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'login',
        resource: 'auth',
        metadata: {
          method: 'phone_otp',
          phone_masked: maskPhone(phone), // ไม่เก็บเบอร์โทรเต็ม
          pdpa_consent: pdpaConsent,
        },
      })

      // ดึง role เพื่อ redirect ไป dashboard ที่ถูกต้อง
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role ?? 'member') as UserRole

      // ถ้ามี next param ให้ไปตามนั้น มิฉะนั้น redirect ตาม role
      const targetPath = nextPath
        ? decodeURIComponent(nextPath)
        : getDashboardPath(role)

      router.push(targetPath)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('expired')) {
        setError('รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่')
      } else if (msg.includes('invalid') || msg.includes('otp')) {
        setError('รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่')
      } else if (msg === 'no_user') {
        setError('เกิดข้อผิดพลาด กรุณาล็อกอินใหม่อีกครั้ง')
      } else {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Card className="shadow-lg border-blue-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">
          {step === 'phone' ? 'เข้าสู่ระบบ' : 'ยืนยันตัวตน'}
        </CardTitle>
        <CardDescription>
          {step === 'phone'
            ? 'กรอกเบอร์โทรศัพท์มือถือเพื่อรับรหัส OTP ทาง SMS'
            : `กรอกรหัส OTP 6 หลัก ที่ส่งไปยัง ${maskPhone(phone)}`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-5" noValidate>
            {/* Phone Input */}
            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทรศัพท์มือถือ</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0812345678"
                value={phone}
                onChange={(e) => {
                  setPhone(sanitizePhone(e.target.value))
                  setError('')
                }}
                disabled={isLoading}
                required
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                aria-describedby="phone-hint"
              />
              <p id="phone-hint" className="text-xs text-gray-500">
                ใส่เบอร์มือถือ 10 หลัก ไม่ต้องใส่ขีด (เช่น 0812345678)
              </p>
            </div>

            {/* PDPA Consent — บังคับก่อน login ตามกฎหมาย PDPA */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-blue-800 mb-1">
                  การยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  ระบบจะเก็บและประมวลผลข้อมูลส่วนบุคคลของท่าน (เลขบัตรประชาชน,
                  เบอร์โทร, ข้อมูลสิทธิประโยชน์) เพื่อการให้บริการตามพระราชบัญญัติประกันสังคม{' '}
                  <Link
                    href="/privacy"
                    className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    อ่านนโยบายความเป็นส่วนตัว
                  </Link>
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group" htmlFor="pdpa-consent">
                <input
                  type="checkbox"
                  id="pdpa-consent"
                  checked={pdpaConsent}
                  onChange={(e) => {
                    setPdpaConsent(e.target.checked)
                    setError('')
                  }}
                  disabled={isLoading}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-blue-600 cursor-pointer"
                  aria-required="true"
                />
                <span className="text-sm text-gray-700 leading-snug group-hover:text-gray-900">
                  ข้าพเจ้า<strong>ยินยอม</strong>ให้สำนักงานประกันสังคม
                  เก็บรวบรวมและใช้ข้อมูลส่วนบุคคลตามวัตถุประสงค์ที่ระบุ
                </span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium"
              disabled={isLoading || !pdpaConsent}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังส่ง OTP...
                </span>
              ) : (
                'ส่งรหัส OTP'
              )}
            </Button>

            <p className="text-center text-sm text-gray-500">
              ยังไม่มีบัญชี?{' '}
              <Link href="/register" className="text-blue-600 hover:underline font-medium">
                ลงทะเบียนใหม่
              </Link>
            </p>
          </form>
        ) : (
          <div className="space-y-5">
            <OTPInput
              onComplete={handleOTPComplete}
              onResend={handleResendOTP}
              disabled={isLoading}
            />

            {isLoading && (
              <p className="text-center text-sm text-blue-600 flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                กำลังตรวจสอบรหัส OTP...
              </p>
            )}

            {error && (
              <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700 text-center">{error}</p>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              className="w-full text-gray-500 hover:text-gray-700"
              onClick={() => {
                setStep('phone')
                setError('')
              }}
              disabled={isLoading}
            >
              ← เปลี่ยนเบอร์โทรศัพท์
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
