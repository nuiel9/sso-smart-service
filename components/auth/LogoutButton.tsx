'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  className?: string
}

export function LogoutButton({ variant = 'ghost', className }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      // ดึง user ก่อน signOut เพื่อบันทึก audit log
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Audit log: บันทึกการ logout (ต้องทำก่อน signOut ขณะที่ยังมี session)
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'logout',
          resource: 'auth',
          metadata: {},
        })
      }
    } catch {
      // Best-effort: ถ้า audit log ล้มเหลว ก็ยังต้อง logout ต่อ
    } finally {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
      aria-label="ออกจากระบบ"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          กำลังออกจากระบบ...
        </span>
      ) : (
        'ออกจากระบบ'
      )}
    </Button>
  )
}
