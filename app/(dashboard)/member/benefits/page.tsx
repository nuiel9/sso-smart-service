import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Stethoscope,
  Briefcase,
  Users,
  Baby,
  Heart,
  Shield,
  Accessibility,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// =============================================================================
// Types - Matches Database Schema
// =============================================================================

interface BenefitFromDB {
  id: string
  member_id: string
  benefit_type: string
  status: 'active' | 'pending' | 'expired' | 'claimed'
  amount: number | null
  eligible_date: string | null
  expiry_date: string | null
  claimed_at: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// Mock Data - Matches Real Database Structure
// =============================================================================

const MOCK_BENEFITS: Omit<BenefitFromDB, 'member_id'>[] = [
  {
    id: 'benefit-001',
    benefit_type: 'illness',
    status: 'active',
    amount: 7500,
    eligible_date: '2024-01-01',
    expiry_date: '2025-12-31',
    claimed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'benefit-002',
    benefit_type: 'maternity',
    status: 'active',
    amount: 15000,
    eligible_date: '2024-01-01',
    expiry_date: null,
    claimed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'benefit-003',
    benefit_type: 'unemployment',
    status: 'active',
    amount: null, // Depends on wage
    eligible_date: '2024-01-01',
    expiry_date: null,
    claimed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'benefit-004',
    benefit_type: 'child_support',
    status: 'pending',
    amount: 800,
    eligible_date: '2024-06-01',
    expiry_date: '2030-06-01',
    claimed_at: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'benefit-005',
    benefit_type: 'old_age',
    status: 'active',
    amount: 117000, // Accumulated
    eligible_date: '2045-01-01',
    expiry_date: null,
    claimed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'benefit-006',
    benefit_type: 'disability',
    status: 'active',
    amount: null,
    eligible_date: '2024-01-01',
    expiry_date: null,
    claimed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'benefit-007',
    benefit_type: 'death',
    status: 'active',
    amount: 50000,
    eligible_date: '2024-01-01',
    expiry_date: null,
    claimed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

// =============================================================================
// Static Config - UI Display Only (not from database)
// =============================================================================

interface BenefitConfig {
  title: string
  description: string
  icon: LucideIcon
  conditions: string[]
  documents: string[]
  amountLabel: string // Description of how amount is calculated
}

const BENEFIT_CONFIG: Record<string, BenefitConfig> = {
  illness: {
    title: 'กรณีเจ็บป่วย',
    description: 'ค่ารักษาพยาบาลและเงินทดแทนการขาดรายได้',
    icon: Stethoscope,
    conditions: [
      'ส่งเงินสมทบครบ 3 เดือน ภายใน 15 เดือน',
      'เจ็บป่วยจนต้องหยุดงาน',
      'มีใบรับรองแพทย์',
    ],
    documents: ['บัตรประชาชน', 'ใบรับรองแพทย์', 'หนังสือรับรองการหยุดงาน'],
    amountLabel: '50% ของค่าจ้าง (สูงสุด 90 วัน/ปี)',
  },
  maternity: {
    title: 'กรณีคลอดบุตร',
    description: 'ค่าคลอดบุตรและเงินสงเคราะห์การหยุดงาน',
    icon: Baby,
    conditions: [
      'ส่งเงินสมทบครบ 5 เดือน ภายใน 15 เดือน',
      'ใช้สิทธิ์ได้ไม่จำกัดครั้ง (ค่าคลอด)',
      'เงินสงเคราะห์ได้ 2 ครั้ง',
    ],
    documents: ['บัตรประชาชน', 'สูติบัตรบุตร', 'สำเนาทะเบียนสมรส (ถ้ามี)'],
    amountLabel: '15,000 บาท + 50% ค่าจ้าง 90 วัน',
  },
  unemployment: {
    title: 'กรณีว่างงาน',
    description: 'เงินทดแทนกรณีถูกเลิกจ้างหรือลาออก',
    icon: Briefcase,
    conditions: [
      'ส่งเงินสมทบครบ 6 เดือน ภายใน 15 เดือน',
      'ขึ้นทะเบียนว่างงานภายใน 30 วันหลังออกจากงาน',
      'รายงานตัวเดือนละครั้ง',
    ],
    documents: ['บัตรประชาชน', 'หนังสือรับรองการออกจากงาน', 'สำเนาสมุดบัญชีธนาคาร'],
    amountLabel: 'ถูกเลิกจ้าง 50% (180 วัน) / ลาออก 30% (90 วัน) ฐานสูงสุด 15,000 บาท',
  },
  child_support: {
    title: 'กรณีสงเคราะห์บุตร',
    description: 'เงินสงเคราะห์บุตรรายเดือน',
    icon: Heart,
    conditions: [
      'ส่งเงินสมทบครบ 12 เดือน ภายใน 36 เดือน',
      'บุตรอายุไม่เกิน 6 ปี',
      'รับได้ไม่เกิน 3 คน',
    ],
    documents: ['บัตรประชาชน', 'สูติบัตรบุตร', 'ทะเบียนสมรส/รับรองบุตร'],
    amountLabel: '800 บาท/เดือน/คน',
  },
  old_age: {
    title: 'กรณีชราภาพ',
    description: 'บำนาญหรือบำเหน็จชราภาพ',
    icon: Users,
    conditions: [
      'อายุครบ 55 ปี',
      'สิ้นสุดความเป็นผู้ประกันตน',
      'ส่งเงินสมทบครบ 180 เดือน (บำนาญ)',
    ],
    documents: ['บัตรประชาชน', 'สำเนาสมุดบัญชีธนาคาร'],
    amountLabel: 'บำนาญ 20% ของค่าจ้างเฉลี่ย 60 เดือนสุดท้าย',
  },
  disability: {
    title: 'กรณีทุพพลภาพ',
    description: 'เงินทดแทนกรณีทุพพลภาพ',
    icon: Accessibility,
    conditions: [
      'ส่งเงินสมทบครบ 3 เดือน ภายใน 15 เดือน',
      'สูญเสียสมรรถภาพไม่น้อยกว่า 35%',
      'มีใบรับรองแพทย์',
    ],
    documents: ['บัตรประชาชน', 'ใบรับรองแพทย์', 'บัตรประจำตัวคนพิการ (ถ้ามี)'],
    amountLabel: '50% ของค่าจ้าง (ตลอดชีวิต)',
  },
  death: {
    title: 'กรณีเสียชีวิต',
    description: 'ค่าทำศพและเงินสงเคราะห์',
    icon: Shield,
    conditions: [
      'ส่งเงินสมทบครบ 1 เดือน ภายใน 6 เดือน',
      'ทายาทหรือผู้จัดการศพเป็นผู้รับสิทธิ์',
    ],
    documents: ['มรณบัตร', 'บัตรประชาชนผู้รับสิทธิ์', 'หลักฐานความเป็นทายาท'],
    amountLabel: 'ค่าทำศพ 50,000 บาท + เงินสงเคราะห์',
  },
}

const STATUS_CONFIG = {
  active: { label: 'พร้อมใช้', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  pending: { label: 'รอดำเนินการ', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  claimed: { label: 'ใช้สิทธิ์แล้ว', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
  expired: { label: 'หมดอายุ', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

// =============================================================================
// Page Component
// =============================================================================

export default async function BenefitsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile (real data)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name_th, section_type, sso_member_id')
    .eq('id', user.id)
    .single()

  // Try to fetch real benefits from database
  const { data: benefitsFromDB } = await supabase
    .from('benefits')
    .select('*')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })

  // Use real data if available, otherwise use mock data
  const benefits = (benefitsFromDB && benefitsFromDB.length > 0)
    ? benefitsFromDB as BenefitFromDB[]
    : MOCK_BENEFITS as unknown as BenefitFromDB[]

  const isUsingMockData = !benefitsFromDB || benefitsFromDB.length === 0

  // Calculate summary from data
  const activeCount = benefits.filter(b => b.status === 'active').length
  const pendingCount = benefits.filter(b => b.status === 'pending').length
  const expiredCount = benefits.filter(b => b.status === 'expired').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-4xl">
          <Link href="/member" className="p-2 -ml-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold">สิทธิประโยชน์ของคุณ</h1>
            <p className="text-xs text-blue-200">
              {profile?.section_type ? `มาตรา ${profile.section_type}` : 'ผู้ประกันตน'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-5 space-y-4 max-w-4xl">
        {/* Summary Card */}
        <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">สิทธิประโยชน์ทั้งหมด</p>
                <p className="text-3xl font-bold mt-1">{benefits.length} รายการ</p>
              </div>
              <div className="text-right">
                <p className="text-blue-200 text-sm">เลขประกันสังคม</p>
                <p className="font-mono mt-1">{profile?.sso_member_id || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/20">
              <div className="text-center">
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-blue-200 text-xs">พร้อมใช้</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-300">{pendingCount}</p>
                <p className="text-blue-200 text-xs">รอดำเนินการ</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{expiredCount}</p>
                <p className="text-blue-200 text-xs">หมดอายุ</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Source Indicator */}
        {isUsingMockData && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-800">
                ข้อมูลตัวอย่าง - เมื่อมีข้อมูลจริงในฐานข้อมูลจะแสดงแทนที่โดยอัตโนมัติ
              </p>
            </CardContent>
          </Card>
        )}

        {/* Benefits List */}
        <div className="space-y-3">
          {benefits.map((benefit) => {
            const config = BENEFIT_CONFIG[benefit.benefit_type]
            if (!config) return null // Skip unknown benefit types

            const Icon = config.icon
            const statusConfig = STATUS_CONFIG[benefit.status]
            const StatusIcon = statusConfig.icon

            return (
              <Card key={benefit.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{config.title}</CardTitle>
                        <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  {/* Amount - from database */}
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 font-medium">จำนวนเงินที่ได้รับ</p>
                    <p className="text-sm font-semibold text-green-800 mt-0.5">
                      {benefit.amount ? formatCurrency(benefit.amount) : config.amountLabel}
                    </p>
                  </div>

                  {/* Dates - from database */}
                  <div className="flex flex-wrap gap-4 text-xs">
                    {benefit.eligible_date && (
                      <div>
                        <span className="text-gray-500">เริ่มมีสิทธิ์: </span>
                        <span className="font-medium">{formatDate(benefit.eligible_date)}</span>
                      </div>
                    )}
                    {benefit.expiry_date && (
                      <div>
                        <span className="text-gray-500">หมดอายุ: </span>
                        <span className="font-medium">{formatDate(benefit.expiry_date)}</span>
                      </div>
                    )}
                    {benefit.claimed_at && (
                      <div>
                        <span className="text-gray-500">ใช้สิทธิ์เมื่อ: </span>
                        <span className="font-medium">{formatDate(benefit.claimed_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Conditions - static config */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">เงื่อนไขการรับสิทธิ์</p>
                    <ul className="space-y-1">
                      {config.conditions.map((condition, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                          {condition}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Documents - static config */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">เอกสารที่ต้องใช้</p>
                    <div className="flex flex-wrap gap-1.5">
                      {config.documents.map((doc, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-normal">
                          {doc}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button className="w-full" variant={benefit.status === 'active' ? 'default' : 'outline'}>
                    {benefit.status === 'active' ? 'ยื่นขอรับสิทธิ์' : 'ดูรายละเอียด'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Help Section */}
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-orange-100">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-orange-800">ต้องการความช่วยเหลือ?</p>
                <p className="text-sm text-orange-700 mt-1">
                  สอบถามข้อมูลเพิ่มเติมได้ที่สายด่วน{' '}
                  <a href="tel:1506" className="font-semibold underline">1506</a>{' '}
                  หรือติดต่อสำนักงานประกันสังคมใกล้บ้าน
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="h-6" />
      </main>
    </div>
  )
}
