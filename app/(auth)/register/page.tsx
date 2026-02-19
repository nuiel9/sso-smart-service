'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
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
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="citizen_id">เลขบัตรประชาชน</Label>
                <Input
                  id="citizen_id"
                  placeholder="x-xxxx-xxxxx-xx-x"
                  maxLength={17}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">ชื่อ</Label>
                  <Input id="first_name" placeholder="ชื่อจริง" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">นามสกุล</Label>
                  <Input id="last_name" placeholder="นามสกุล" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="08x-xxx-xxxx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">อีเมล (ไม่บังคับ)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                />
              </div>

              <Button type="submit" className="w-full">
                ลงทะเบียน
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
