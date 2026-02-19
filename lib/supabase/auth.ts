import { createClient } from './server'
import type { UserRole } from '@/lib/types/database'

/**
 * ดึงข้อมูลโปรไฟล์ของผู้ใช้ที่ login อยู่
 * คืนค่า null หากไม่มี session หรือไม่พบโปรไฟล์
 */
export async function getUserProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

/**
 * ดึง role ของผู้ใช้ที่ login อยู่
 * คืนค่า null หากไม่มี session
 */
export async function getUserRole(): Promise<UserRole | null> {
  const profile = await getUserProfile()
  return (profile?.role as UserRole) ?? null
}

/**
 * แปลง role เป็น path ของ dashboard
 */
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'officer':
      return '/officer'
    default:
      return '/member'
  }
}

/**
 * บันทึก audit log จาก Server Component หรือ API Route
 * ใช้ Supabase client ฝั่ง server (ไม่ต้องการ auth.uid())
 */
export async function logAuditAction(params: {
  userId: string | null
  action: string
  resource: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}) {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      resource: params.resource,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    })
  } catch {
    // Audit log failure ไม่ควรหยุดการทำงานหลัก
    console.error('[audit] Failed to write audit log:', params.action)
  }
}

/**
 * ตรวจสอบว่า role มีสิทธิ์เข้าถึง path ที่กำหนดหรือไม่
 */
export function hasRoleAccess(role: UserRole, path: string): boolean {
  if (path.startsWith('/admin')) return role === 'admin'
  if (path.startsWith('/officer')) return role === 'officer' || role === 'admin'
  if (path.startsWith('/member')) return true // ทุก role เข้าถึงได้
  return false
}

/**
 * แปลงเบอร์โทรศัพท์ไทยเป็น E.164 format (+66XXXXXXXXX)
 * รองรับ: 0812345678, 081-234-5678, +66812345678
 */
export function toE164Phone(phone: string): string {
  // ลบ non-digit ออกก่อน
  const digits = phone.replace(/\D/g, '')
  // ถ้าขึ้นต้นด้วย 66 → เป็น +66 format อยู่แล้ว
  if (digits.startsWith('66') && digits.length === 11) {
    return `+${digits}`
  }
  // ถ้าขึ้นต้นด้วย 0 → แปลงเป็น +66
  if (digits.startsWith('0') && digits.length === 10) {
    return `+66${digits.slice(1)}`
  }
  return `+66${digits}`
}
