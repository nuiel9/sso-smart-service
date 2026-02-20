import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Bell,
  BellRing,
  Gift,
  CreditCard,
  AlertTriangle,
  Info,
  CheckCircle,
  Trash2,
  Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// =============================================================================
// Types & Mock Data
// =============================================================================

interface Notification {
  id: string
  type: 'benefit_reminder' | 'payment_status' | 'section40_outreach' | 'system'
  title: string
  body: string
  read: boolean
  sent_at: string
  action_url?: string
  action_label?: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-001',
    type: 'benefit_reminder',
    title: 'สิทธิ์กรณีเจ็บป่วยใกล้หมดอายุ',
    body: 'สิทธิ์การเบิกค่ารักษาพยาบาลของคุณจะหมดอายุในอีก 30 วัน กรุณาตรวจสอบและต่ออายุ',
    read: false,
    sent_at: '2025-02-20T10:30:00Z',
    action_url: '/member/benefits',
    action_label: 'ตรวจสอบสิทธิ์',
  },
  {
    id: 'notif-002',
    type: 'payment_status',
    title: 'โอนเงินสำเร็จ',
    body: 'เงินทดแทนกรณีเจ็บป่วย จำนวน 7,500 บาท โอนเข้าบัญชีของคุณเรียบร้อยแล้ว',
    read: false,
    sent_at: '2025-02-19T14:00:00Z',
    action_url: '/member/payments',
    action_label: 'ดูรายละเอียด',
  },
  {
    id: 'notif-003',
    type: 'system',
    title: 'อัปเดตข้อมูลส่วนตัว',
    body: 'กรุณาตรวจสอบและอัปเดตข้อมูลส่วนตัวของคุณให้เป็นปัจจุบัน เพื่อความสะดวกในการรับสิทธิประโยชน์',
    read: true,
    sent_at: '2025-02-18T09:00:00Z',
  },
  {
    id: 'notif-004',
    type: 'section40_outreach',
    title: 'แนะนำประกันสังคม มาตรา 40',
    body: 'คุณสามารถสมัครประกันสังคม มาตรา 40 เพื่อรับสิทธิประโยชน์เพิ่มเติม เริ่มต้นเพียง 70 บาท/เดือน',
    read: true,
    sent_at: '2025-02-15T11:00:00Z',
    action_url: '/member/benefits',
    action_label: 'ดูรายละเอียด',
  },
  {
    id: 'notif-005',
    type: 'payment_status',
    title: 'เงินสงเคราะห์บุตรประจำเดือน',
    body: 'เงินสงเคราะห์บุตร จำนวน 800 บาท โอนเข้าบัญชีของคุณเรียบร้อยแล้ว',
    read: true,
    sent_at: '2025-02-10T10:00:00Z',
  },
  {
    id: 'notif-006',
    type: 'benefit_reminder',
    title: 'ใกล้ครบกำหนดส่งเอกสาร',
    body: 'คำขอเบิกค่ารักษาพยาบาลของคุณรอเอกสารเพิ่มเติม กรุณาส่งภายใน 7 วัน',
    read: true,
    sent_at: '2025-02-08T15:30:00Z',
  },
  {
    id: 'notif-007',
    type: 'system',
    title: 'ยินดีต้อนรับสู่ SSO Smart Service',
    body: 'ขอบคุณที่ลงทะเบียนใช้งานระบบบริการอัจฉริยะประกันสังคม คุณสามารถตรวจสอบสิทธิ์และสอบถาม AI ได้ตลอด 24 ชั่วโมง',
    read: true,
    sent_at: '2025-02-01T08:00:00Z',
  },
]

const TYPE_CONFIG = {
  benefit_reminder: {
    icon: Gift,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'สิทธิประโยชน์',
  },
  payment_status: {
    icon: CreditCard,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'การเงิน',
  },
  section40_outreach: {
    icon: BellRing,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'แนะนำ',
  },
  system: {
    icon: Info,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'ระบบ',
  },
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'เมื่อกี้'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'เมื่อวาน'
  if (days < 7) return `${days} วันที่แล้ว`
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
  })
}

// =============================================================================
// Page Component
// =============================================================================

export default async function NotificationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length

  // Group notifications by date
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const groupedNotifications = MOCK_NOTIFICATIONS.reduce((acc, notif) => {
    const notifDate = new Date(notif.sent_at).toDateString()
    let group: string
    if (notifDate === today) {
      group = 'วันนี้'
    } else if (notifDate === yesterday) {
      group = 'เมื่อวาน'
    } else {
      group = 'ก่อนหน้านี้'
    }
    if (!acc[group]) acc[group] = []
    acc[group].push(notif)
    return acc
  }, {} as Record<string, Notification[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-4xl">
          <div className="flex items-center gap-3">
            <Link href="/member" className="p-2 -ml-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-semibold">การแจ้งเตือน</h1>
              <p className="text-xs text-blue-200">
                {unreadCount > 0 ? `${unreadCount} รายการยังไม่ได้อ่าน` : 'อ่านทั้งหมดแล้ว'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-5 space-y-4 max-w-4xl">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(TYPE_CONFIG).map(([key, config]) => {
            const Icon = config.icon
            const count = MOCK_NOTIFICATIONS.filter(n => n.type === key).length
            return (
              <Card key={key} className="text-center">
                <CardContent className="p-3">
                  <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center mx-auto mb-1`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[10px] text-gray-500">{config.label}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Actions */}
        {unreadCount > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              อ่านทั้งหมด
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1 text-red-600 hover:text-red-700">
              <Trash2 className="w-3.5 h-3.5" />
              ลบที่อ่านแล้ว
            </Button>
          </div>
        )}

        {/* Notifications List */}
        {Object.entries(groupedNotifications).map(([group, notifications]) => (
          <div key={group}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
              {group}
            </h2>
            <Card>
              <CardContent className="p-0 divide-y">
                {notifications.map((notif) => {
                  const config = TYPE_CONFIG[notif.type]
                  const Icon = config.icon

                  return (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-full ${config.bgColor} shrink-0 h-fit`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              {formatTimeAgo(notif.sent_at)}
                            </span>
                          </div>

                          <p className={`text-sm mt-1 ${!notif.read ? 'text-gray-700' : 'text-gray-500'}`}>
                            {notif.body}
                          </p>

                          {notif.action_url && notif.action_label && (
                            <Link href={notif.action_url}>
                              <Button variant="link" size="sm" className="px-0 h-auto mt-2 text-blue-600">
                                {notif.action_label} →
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Empty State */}
        {MOCK_NOTIFICATIONS.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">ยังไม่มีการแจ้งเตือน</p>
            </CardContent>
          </Card>
        )}

        {/* Notification Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              ตั้งค่าการแจ้งเตือน
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {[
              { label: 'แจ้งเตือนสิทธิประโยชน์', desc: 'เมื่อสิทธิ์ใกล้หมดอายุ', enabled: true },
              { label: 'แจ้งเตือนการเงิน', desc: 'เมื่อมีการโอนเงิน', enabled: true },
              { label: 'ข่าวสารและโปรโมชัน', desc: 'ข้อมูลโครงการใหม่ๆ', enabled: false },
            ].map((setting, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{setting.label}</p>
                  <p className="text-xs text-gray-500">{setting.desc}</p>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${setting.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${setting.enabled ? 'translate-x-4' : ''}`} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="h-6" />
      </main>
    </div>
  )
}
