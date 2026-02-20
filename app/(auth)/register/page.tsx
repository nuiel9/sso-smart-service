'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()

      // Sign up with email/password
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name_th: fullName,
            phone: phone,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities?.length === 0) {
          setError('อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น')
          return
        }

        // For demo: auto-confirm by redirecting to login
        setSuccess(true)
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      console.error('Register error:', err)
      if (msg.includes('already registered')) {
        setError('อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น')
      } else if (msg.includes('password')) {
        setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      } else {
        setError(`เกิดข้อผิดพลาด: ${msg || 'กรุณาลองใหม่อีกครั้ง'}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">ลงทะเบียนสำเร็จ!</h2>
              <p className="text-gray-600">กำลังไปหน้าเข้าสู่ระบบ...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">
            สำนักงานประกันสังคม
          </h1>
          <p className="text-gray-600 mt-2">
            ลงทะเบียนผู้ใช้งานใหม่
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ลงทะเบียน</CardTitle>
            <CardDescription>
              กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้งาน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">ชื่อ-นามสกุล</Label>
                <Input
                  id="fullName"
                  placeholder="ชื่อ นามสกุล"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0812345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังลงทะเบียน...
                  </span>
                ) : (
                  'ลงทะเบียน'
                )}
              </Button>

              <p className="text-center text-sm text-gray-600">
                มีบัญชีอยู่แล้ว?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
