'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OTPInput } from './OTPInput'
import { createClient } from '@/lib/supabase/client'

type Step = 'phone' | 'otp'

export function LoginForm() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+66${phone.replace(/^0/, '')}`,
      })

      if (error) throw error
      setStep('otp')
    } catch (err) {
      setError('ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPComplete = async (otp: string) => {
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        phone: `+66${phone.replace(/^0/, '')}`,
        token: otp,
        type: 'sms',
      })

      if (error) throw error
      router.push('/member')
    } catch (err) {
      setError('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>เข้าสู่ระบบ</CardTitle>
        <CardDescription>
          {step === 'phone'
            ? 'กรอกเบอร์โทรศัพท์เพื่อรับรหัส OTP'
            : `กรอกรหัส OTP ที่ส่งไปยัง ${phone}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="08x-xxx-xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'กำลังส่ง OTP...' : 'ส่งรหัส OTP'}
            </Button>

            <p className="text-center text-sm text-gray-600">
              ยังไม่มีบัญชี?{' '}
              <Link href="/register" className="text-blue-600 hover:underline">
                ลงทะเบียน
              </Link>
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <OTPInput onComplete={handleOTPComplete} disabled={isLoading} />

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep('phone')}
              disabled={isLoading}
            >
              เปลี่ยนเบอร์โทรศัพท์
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
