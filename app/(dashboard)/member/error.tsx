'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function MemberDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to monitoring service (เพิ่ม Sentry/Datadog ตรงนี้)
    console.error('[member/error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">เกิดข้อผิดพลาด</h2>
          <p className="text-sm text-gray-500 mt-1">
            ไม่สามารถโหลดข้อมูลได้ในขณะนี้
            <br />
            กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 mt-2 font-mono">รหัส: {error.digest}</p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-blue-700 hover:bg-blue-800 text-white"
          >
            ลองใหม่
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/login')}
          >
            ออกจากระบบ
          </Button>
        </div>
      </div>
    </div>
  )
}
