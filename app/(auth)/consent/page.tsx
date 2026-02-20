import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ConsentForm } from '@/components/auth/ConsentForm'
import { logAuditFromServer, AuditAction } from '@/lib/audit/logger'
import type { UserRole } from '@/lib/types/database'

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัว — SSO Smart Service',
  description: 'กรุณาอ่านและยินยอมตามนโยบายความเป็นส่วนตัวของสำนักงานประกันสังคม',
}

export default async function ConsentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ต้อง login ก่อนเข้าหน้านี้
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, pdpa_consent')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'member') as UserRole
  const alreadyConsented = profile?.pdpa_consent ?? false

  // บันทึกว่า user เข้ามาดูหน้า consent
  await logAuditFromServer({
    userId: user.id,
    action: AuditAction.VIEW_PROFILE,
    resource: 'consent_page',
    metadata: { already_consented: alreadyConsented },
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center shadow-lg ring-4 ring-blue-100">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-900">
              {alreadyConsented ? 'จัดการการยินยอม PDPA' : 'นโยบายความเป็นส่วนตัว'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              สำนักงานประกันสังคม · ระบบบริการอัจฉริยะ
            </p>
          </div>
        </div>

        {/* Policy card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Policy summary */}
          <div className="bg-blue-700 px-6 py-5 text-white">
            <h2 className="font-semibold text-base mb-1">นโยบายการคุ้มครองข้อมูลส่วนบุคคล</h2>
            <p className="text-blue-100 text-xs leading-relaxed">
              ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) สำนักงานประกันสังคม
              มีหน้าที่แจ้งให้ท่านทราบถึงวัตถุประสงค์ในการเก็บรวบรวมข้อมูลของท่าน
              และขอความยินยอมจากท่านก่อนการประมวลผลข้อมูล
            </p>
          </div>

          {/* Policy details */}
          <div className="px-6 py-5 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              ข้อมูลที่เราเก็บรวบรวม
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-600">
              {[
                'ชื่อ-นามสกุล และเลขบัตรประชาชน (เข้ารหัสตาม PDPA)',
                'เลขสมาชิกประกันสังคม และมาตราที่สังกัด',
                'เบอร์โทรศัพท์และอีเมล',
                'ประวัติการใช้สิทธิประโยชน์และสถานะเงิน',
                'ประวัติการสนทนากับ AI Chatbot',
                'ข้อมูลการเข้าใช้งานระบบ (IP Address, เวลา)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-3">
              วัตถุประสงค์การใช้ข้อมูล
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-600">
              {[
                'ให้บริการและตรวจสอบสิทธิประโยชน์ประกันสังคม',
                'วิเคราะห์และแนะนำสิทธิ์ที่เหมาะสมด้วย AI',
                'ส่งการแจ้งเตือนสิทธิ์ใกล้หมดอายุและผลการอนุมัติ',
                'พัฒนาคุณภาพการให้บริการของ สปส.',
                'ปฏิบัติตามกฎหมายและระเบียบที่เกี่ยวข้อง',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">สิทธิ์ของท่าน:</span> ท่านมีสิทธิ์เข้าถึง แก้ไข
                ลบ คัดค้าน หรือขอรับข้อมูลของท่านได้ตลอดเวลา
                รวมถึงสิทธิ์ในการถอนความยินยอมโดยไม่กระทบสิทธิ์ที่ได้รับจากการยินยอมก่อนหน้า
              </p>
            </div>
          </div>

          {/* Consent form */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              {alreadyConsented
                ? 'สถานะการยินยอมของท่าน'
                : 'กรุณาเลือกรายการที่ท่านยินยอม'}
            </h3>
            <ConsentForm userRole={role} alreadyConsented={alreadyConsented} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          SSO Smart Service Platform · สำนักงานประกันสังคม กระทรวงแรงงาน
        </p>
      </div>
    </div>
  )
}
