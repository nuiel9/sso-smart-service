'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

// =============================================================================
// Types
// =============================================================================

interface ConsentItem {
  id: string
  label: string
  description: string
  required: boolean
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: 'data_collection',
    label: 'ยินยอมให้เก็บข้อมูลส่วนบุคคล',
    description:
      'ยินยอมให้สำนักงานประกันสังคม (สปส.) เก็บรวบรวม ใช้ และประมวลผลข้อมูลส่วนบุคคลของท่าน เช่น ชื่อ-สกุล เลขบัตรประชาชน เบอร์โทรศัพท์ และข้อมูลสิทธิประโยชน์ เพื่อการให้บริการตามภารกิจของ สปส.',
    required: true,
  },
  {
    id: 'ai_analysis',
    label: 'ยินยอมให้ใช้ AI วิเคราะห์ข้อมูล',
    description:
      'ยินยอมให้ระบบ AI ของ สปส. วิเคราะห์ข้อมูลของท่านเพื่อให้คำแนะนำเกี่ยวกับสิทธิประโยชน์ ตอบข้อสอบถาม และปรับปรุงคุณภาพการให้บริการ ข้อมูลจะไม่ถูกเปิดเผยต่อบุคคลภายนอก',
    required: true,
  },
  {
    id: 'notifications',
    label: 'ยินยอมให้ส่งการแจ้งเตือน',
    description:
      'ยินยอมให้ สปส. ส่งการแจ้งเตือนผ่านช่องทางที่ท่านเลือก (แอปพลิเคชัน, LINE, SMS) เกี่ยวกับสิทธิประโยชน์ การอนุมัติเงิน และข่าวสารสำคัญ ท่านสามารถยกเลิกการรับแจ้งเตือนได้ตลอดเวลา',
    required: false,
  },
]

// =============================================================================
// Props
// =============================================================================

interface ConsentFormProps {
  /** role ของ user — ใช้ redirect หลัง consent */
  userRole: 'member' | 'officer' | 'admin'
  /** true = เคย consent แล้ว (มาดูหรือแก้ไข) */
  alreadyConsented: boolean
}

// =============================================================================
// Component
// =============================================================================

export function ConsentForm({ userRole, alreadyConsented }: ConsentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONSENT_ITEMS.map((item) => [item.id, alreadyConsented])),
  )
  const [error, setError] = useState<string | null>(null)
  const [declined, setDeclined] = useState(false)

  const allRequiredChecked = CONSENT_ITEMS.filter((i) => i.required).every(
    (i) => checked[i.id],
  )

  const dashboardPath =
    userRole === 'admin' ? '/admin' : userRole === 'officer' ? '/officer' : '/member'

  // --------------------------------------------------------------------------
  // Submit consent
  // --------------------------------------------------------------------------
  async function handleConsent() {
    if (!allRequiredChecked) return
    setError(null)

    startTransition(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('หมดอายุการเข้าสู่ระบบ กรุณา login ใหม่')
        return
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          pdpa_consent: true,
          pdpa_consent_date: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateErr) {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
        return
      }

      // บันทึก audit + granular consent ใน metadata ผ่าน API route
      await fetch('/api/member/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checked,
          action: alreadyConsented ? 'update' : 'grant',
        }),
      }).catch(() => {
        /* non-blocking */
      })

      router.replace(dashboardPath)
    })
  }

  // --------------------------------------------------------------------------
  // Decline consent
  // --------------------------------------------------------------------------
  async function handleDecline() {
    setDeclined(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('profiles')
        .update({ pdpa_consent: false, pdpa_consent_date: null })
        .eq('id', user.id)
    }
  }

  // --------------------------------------------------------------------------
  // Declined state
  // --------------------------------------------------------------------------
  if (declined) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <XCircle className="w-14 h-14 text-red-400" />
        <h2 className="text-xl font-semibold text-gray-800">ท่านไม่ยินยอม</h2>
        <p className="text-gray-500 max-w-sm text-sm leading-relaxed">
          ท่านสามารถกลับมายินยอมในภายหลังได้ตลอดเวลา หากต้องการใช้บริการระบบ
          SSO Smart Service กรุณายืนยันนโยบายความเป็นส่วนตัว
        </p>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => setDeclined(false)}>
            กลับไปตรวจสอบ
          </Button>
          <Button
            variant="ghost"
            className="text-gray-400"
            onClick={() => {
              const supabase = createClient()
              supabase.auth.signOut().then(() => router.replace('/login'))
            }}
          >
            ออกจากระบบ
          </Button>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Main form
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Consent items */}
      <div className="space-y-3">
        {CONSENT_ITEMS.map((item) => (
          <label
            key={item.id}
            className={[
              'flex gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
              checked[item.id]
                ? 'bg-blue-50 border-blue-300'
                : 'bg-white border-gray-200 hover:bg-gray-50',
            ].join(' ')}
          >
            {/* Checkbox */}
            <div className="mt-0.5 shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={!!checked[item.id]}
                onChange={(e) =>
                  setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                }
              />
              <div
                className={[
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                  checked[item.id]
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-gray-300',
                ].join(' ')}
                aria-hidden
              >
                {checked[item.id] && (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className="w-3 h-3 text-white"
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Text */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900">{item.label}</span>
                {item.required && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                    จำเป็น
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {item.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 text-center bg-red-50 py-2 px-3 rounded-lg">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleConsent}
          disabled={!allRequiredChecked || isPending}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white h-12 text-base font-semibold"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังบันทึก…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {alreadyConsented ? 'อัปเดตการยินยอม' : 'ยินยอมและเข้าสู่ระบบ'}
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          onClick={handleDecline}
          disabled={isPending}
          className="w-full text-gray-500 hover:text-red-600 h-10 text-sm"
        >
          ไม่ยินยอม
        </Button>
      </div>

      {/* Legal note */}
      <p className="text-center text-[11px] text-gray-400 leading-relaxed">
        ท่านมีสิทธิ์ถอนความยินยอม แก้ไข หรือขอลบข้อมูลได้ตลอดเวลา
        ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 มาตรา 19-29
        <br />
        ติดต่อ DPO: dpo@sso.go.th · โทร 1506
      </p>
    </div>
  )
}
