import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: 'เข้าสู่ระบบบริการอัจฉริยะสำนักงานประกันสังคม (สปส.)',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* SSO Branding Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            {/* Logo สปส. — แทนที่ด้วย <img src="/sso-logo.png"> เมื่อได้รับ asset จริง */}
            <div
              className="w-24 h-24 rounded-full bg-blue-700 flex items-center justify-center shadow-xl ring-4 ring-blue-100"
              aria-label="โลโก้สำนักงานประกันสังคม"
            >
              <span className="text-white text-3xl font-bold tracking-tight select-none">
                สปส.
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-blue-900 leading-tight">
              สำนักงานประกันสังคม
            </h1>
            <p className="text-blue-700 font-semibold mt-1 text-lg">
              เข้าสู่ระบบประกันสังคมอัจฉริยะ
            </p>
            <p className="text-gray-400 text-xs mt-1 tracking-wide">
              SSO Smart Service Platform
            </p>
          </div>
        </div>

        {/* Login Form — Client Component ใช้ Suspense เพราะมี useSearchParams */}
        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 leading-relaxed">
          ระบบนี้ดำเนินการตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          <br />
          &copy; 2568 สำนักงานประกันสังคม กระทรวงแรงงาน
        </p>
      </div>
    </div>
  )
}
