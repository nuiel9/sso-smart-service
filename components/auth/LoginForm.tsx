'use client'

import { useState } from 'react'
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
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types/database'

/** Dashboard path ตาม role */
function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'officer': return '/officer'
    default: return '/member'
  }
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      const user = data.user
      if (!user) throw new Error('NO_USER')

      // Audit log: บันทึกการ login
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'login',
        resource: 'auth',
        metadata: {
          method: 'email_password',
          email: email,
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
      if (msg.includes('invalid login credentials')) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      } else if (msg.includes('email not confirmed')) {
        setError('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ')
      } else {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-lg border-blue-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
        <CardDescription>
          กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              disabled={isLoading}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              disabled={isLoading}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังเข้าสู่ระบบ...
              </span>
            ) : (
              'เข้าสู่ระบบ'
            )}
          </Button>

          <p className="text-center text-sm text-gray-500">
            ยังไม่มีบัญชี?{' '}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              ลงทะเบียนใหม่
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
