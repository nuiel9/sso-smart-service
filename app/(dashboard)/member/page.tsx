import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Stethoscope,
  Briefcase,
  Users,
  Baby,
  Heart,
  Shield,
  Accessibility,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BenefitsCard } from '@/components/dashboard/BenefitsCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { LogoutButton } from '@/components/auth/LogoutButton'
import type { BenefitStatus, SectionType } from '@/lib/types/database'

export const metadata: Metadata = {
  title: 'หน้าหลัก',
}

// =============================================================================
// Static benefit type definitions
// ไม่ขึ้นอยู่กับ DB — ใช้ merge กับ benefits rows เพื่อแสดงผล
// =============================================================================

interface BenefitTypeDef {
  type: string
  title: string
  description: string
  icon: LucideIcon
  /** Sections ที่มีสิทธิ์ได้รับ */
  eligibleSections: SectionType[]
}

const BENEFIT_TYPES: BenefitTypeDef[] = [
  {
    type: 'illness',
    title: 'กรณีเจ็บป่วย',
    description: 'ค่ารักษาพยาบาลและเงินทดแทนการขาดรายได้ เมื่อเจ็บป่วยหรืออุบัติเหตุ',
    icon: Stethoscope,
    eligibleSections: ['33', '39', '40'],
  },
  {
    type: 'unemployment',
    title: 'กรณีว่างงาน',
    description: 'เงินทดแทนกรณีว่างงาน สูงสุด 180 วัน ร้อยละ 50–70 ของค่าจ้าง',
    icon: Briefcase,
    eligibleSections: ['33'],
  },
  {
    type: 'old_age',
    title: 'กรณีชราภาพ',
    description: 'บำนาญชราภาพรายเดือน หรือบำเหน็จชราภาพก้อนเดียว',
    icon: Users,
    eligibleSections: ['33', '39', '40'],
  },
  {
    type: 'maternity',
    title: 'กรณีคลอดบุตร',
    description: 'ค่าคลอดบุตรเหมาจ่าย 15,000 บาท และเงินสงเคราะห์การหยุดงาน',
    icon: Baby,
    eligibleSections: ['33', '39'],
  },
  {
    type: 'child_support',
    title: 'กรณีสงเคราะห์บุตร',
    description: 'เงินสงเคราะห์บุตรชอบด้วยกฎหมาย อายุไม่เกิน 6 ปี รายเดือน',
    icon: Heart,
    eligibleSections: ['33', '39'],
  },
  {
    type: 'death',
    title: 'กรณีเสียชีวิต',
    description: 'ค่าทำศพ 50,000 บาท และเงินสงเคราะห์ครอบครัว',
    icon: Shield,
    eligibleSections: ['33', '39', '40'],
  },
  {
    type: 'disability',
    title: 'กรณีทุพพลภาพ',
    description: 'เงินทดแทนการขาดรายได้ตลอดชีวิต กรณีสูญเสียสมรรถภาพ',
    icon: Accessibility,
    eligibleSections: ['33', '39', '40'],
  },
]

// =============================================================================
// Helpers
// =============================================================================

function getSectionLabel(section: SectionType | null): string {
  if (!section) return 'ผู้ประกันตน'
  return `ผู้ประกันตน มาตรา ${section}`
}

function getDisplayName(profile: {
  full_name_th: string | null
  full_name_en: string | null
}): string {
  return profile.full_name_th ?? profile.full_name_en ?? 'ผู้ประกันตน'
}

const ACTIVITY_LABELS: Record<string, string> = {
  login: '🔐 เข้าสู่ระบบ',
  logout: '🚪 ออกจากระบบ',
  view_benefits: '👁️ ดูสิทธิประโยชน์',
  update_profile: '✏️ อัปเดตข้อมูลส่วนตัว',
  claim_benefit: '📝 ยื่นเบิกสิทธิ์',
  view_payments: '💰 ตรวจสอบการชำระเงิน',
}

function formatActivity(action: string): string {
  return ACTIVITY_LABELS[action] ?? `🔹 ${action}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'เมื่อกี้'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'เมื่อวาน'
  return `${days} วันที่แล้ว`
}

// =============================================================================
// Page — Async Server Component
// =============================================================================

export default async function MemberDashboard() {
  const supabase = await createClient()

  // ตรวจสอบ session — ถ้าไม่มีให้ redirect to /login
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ===== Parallel data fetching (ลด latency ด้วย Promise.all) =====
  const [profileResult, benefitsResult, notificationsResult, activityResult] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),

      supabase
        .from('benefits')
        .select('*')
        .eq('member_id', user.id)
        .order('expiry_date', { ascending: true }),

      supabase
        .from('notifications')
        .select('*')
        .eq('member_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(5),

      supabase
        .from('audit_logs')
        .select('action, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

  const profile = profileResult.data
  if (!profile) redirect('/login') // profile ควรมีเสมอหลัง auth

  const benefits = benefitsResult.data ?? []
  const notifications = notificationsResult.data ?? []
  const recentActivity = activityResult.data ?? []

  // ===== Benefit summary stats =====
  const activeBenefits = benefits.filter((b) => b.status === 'active')

  const expiringSoon = activeBenefits.filter((b) => {
    if (!b.expiry_date) return false
    const diff = new Date(b.expiry_date).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  })

  const unreadNotifications = notifications.filter((n) => !n.read)

  // ===== Merge benefit type defs with DB rows =====
  // กรองตาม section_type ของผู้ใช้ก่อน แล้ว merge กับ DB data
  const benefitCards = BENEFIT_TYPES.map((def) => {
    const isEligible = profile.section_type
      ? def.eligibleSections.includes(profile.section_type)
      : true // ถ้าไม่ทราบ section type ให้แสดงทั้งหมด

    const dbRow = benefits.find((b) => b.benefit_type === def.type)

    return {
      benefitType: def.type,
      title: def.title,
      description: def.description,
      icon: def.icon,
      status: isEligible
        ? ((dbRow?.status ?? 'active') as BenefitStatus)
        : ('not_eligible' as const),
      amount: dbRow?.amount ?? null,
      expiryDate: dbRow?.expiry_date ?? null,
      eligibleDate: dbRow?.eligible_date ?? null,
    }
  })

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===================================================
          Header — sticky top bar สี Navy ของ สปส.
      =================================================== */}
      <header className="bg-[#1e3a5f] text-white sticky top-0 z-10 shadow-md">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-4xl">
          {/* Left: Logo + brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold leading-none">สปส</span>
            </div>
            <div className="hidden xs:block">
              <p className="text-sm font-semibold leading-none">SSO Smart Service</p>
              <p className="text-[11px] text-blue-300 leading-none mt-0.5">
                ระบบบริการอัจฉริยะ
              </p>
            </div>
          </div>

          {/* Right: Bell + user info + logout */}
          <div className="flex items-center gap-1">
            <NotificationBell initialNotifications={notifications} />

            <div className="hidden sm:block text-right px-2">
              <p className="text-sm font-medium leading-none">{getDisplayName(profile)}</p>
              <p className="text-[11px] text-blue-300 mt-0.5 leading-none">
                {getSectionLabel(profile.section_type)}
              </p>
            </div>

            <LogoutButton
              variant="ghost"
              className="text-white hover:bg-white/10 px-2 text-xs"
            />
          </div>
        </div>
      </header>

      {/* ===================================================
          Main Content
      =================================================== */}
      <main className="container mx-auto px-4 py-5 space-y-6 max-w-4xl">

        {/* --------- Welcome / Stats Card --------- */}
        <div className="bg-gradient-to-br from-[#1e3a5f] to-blue-700 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-blue-200 text-xs">ยินดีต้อนรับ</p>
              <h1 className="text-xl font-bold mt-0.5 truncate">
                สวัสดี, {getDisplayName(profile)}
              </h1>
              <p className="text-blue-200 text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span>{getSectionLabel(profile.section_type)}</span>
                {profile.sso_member_id && (
                  <span className="text-blue-300 font-mono">
                    #{profile.sso_member_id}
                  </span>
                )}
              </p>
            </div>
            {/* Avatar placeholder */}
            <div
              className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0"
              aria-hidden
            >
              <span className="text-2xl">👤</span>
            </div>
          </div>

          {/* 3-column stats row */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/20">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">{activeBenefits.length}</p>
              <p className="text-blue-200 text-xs mt-0.5">สิทธิ์ใช้ได้</p>
            </div>
            <div className="text-center">
              <p
                className={`text-2xl font-bold tabular-nums ${
                  expiringSoon.length > 0 ? 'text-yellow-300' : ''
                }`}
              >
                {expiringSoon.length}
              </p>
              <p className="text-blue-200 text-xs mt-0.5">ใกล้หมดอายุ</p>
            </div>
            <div className="text-center">
              <p
                className={`text-2xl font-bold tabular-nums ${
                  unreadNotifications.length > 0 ? 'text-orange-300' : ''
                }`}
              >
                {unreadNotifications.length}
              </p>
              <p className="text-blue-200 text-xs mt-0.5">แจ้งเตือนใหม่</p>
            </div>
          </div>
        </div>

        {/* --------- Quick Actions --------- */}
        <section aria-labelledby="quick-actions-heading">
          <h2
            id="quick-actions-heading"
            className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3"
          >
            บริการด่วน
          </h2>
          <QuickActions />
        </section>

        {/* --------- Benefits Grid --------- */}
        <section aria-labelledby="benefits-heading">
          <div className="flex items-center justify-between mb-3">
            <h2
              id="benefits-heading"
              className="text-sm font-semibold text-gray-700 uppercase tracking-wide"
            >
              สิทธิประโยชน์ของคุณ
            </h2>
            {expiringSoon.length > 0 && (
              <span className="text-xs text-yellow-700 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">
                ⚠️ {expiringSoon.length} รายการใกล้หมดอายุ
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {benefitCards.map((card) => (
              <BenefitsCard key={card.benefitType} {...card} />
            ))}
          </div>
        </section>

        {/* --------- Recent Activity --------- */}
        {recentActivity.length > 0 && (
          <section aria-labelledby="activity-heading">
            <h2
              id="activity-heading"
              className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3"
            >
              กิจกรรมล่าสุด
            </h2>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm">
                    {formatActivity(item.action).slice(0, 2)}
                  </div>
                  <p className="text-sm text-gray-800 flex-1 min-w-0 truncate">
                    {formatActivity(item.action).slice(3)}
                  </p>
                  <time
                    className="text-xs text-gray-400 shrink-0"
                    dateTime={item.created_at}
                  >
                    {timeAgo(item.created_at)}
                  </time>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* bottom padding for mobile nav */}
        <div className="h-6" />
      </main>
    </div>
  )
}
