'use client'

import { useState, useTransition } from 'react'
import { Download, Lock, FileJson, FileText, Shield, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DataExportPage() {
  const [password, setPassword] = useState('')
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleExport(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setError(null)

    startTransition(async () => {
      const res = await fetch('/api/member/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, format }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        return
      }

      // Trigger browser download
      const blob = await res.blob()
      const contentDisposition = res.headers.get('content-disposition') ?? ''
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const filename =
        filenameMatch?.[1] ?? `sso-data-export.${format}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      setSuccess(true)
      setPassword('')
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-4 shadow-md">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Export ข้อมูลส่วนตัว</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            สิทธิ์การเข้าถึงข้อมูลตาม พ.ร.บ. PDPA มาตรา 63
            <br />
            ดาวน์โหลดข้อมูลส่วนบุคคลทั้งหมดที่ สปส. เก็บไว้
          </p>
        </div>

        {success && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6 text-green-800">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium text-sm">ดาวน์โหลดสำเร็จ</p>
              <p className="text-xs mt-0.5">ระบบได้บันทึก audit log การ export แล้ว</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {/* What is included */}
          <div className="px-6 py-5 border-b bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              ข้อมูลที่จะถูก Export
            </h2>
            <ul className="space-y-1.5">
              {[
                ['ข้อมูลโปรไฟล์', 'ชื่อ, เบอร์โทร, มาตราประกันสังคม'],
                ['สิทธิประโยชน์', 'ประวัติสิทธิ์และสถานะ'],
                ['ประวัติการสนทนา', 'Chat sessions กับ AI'],
                ['การแจ้งเตือน', 'ประวัติ notifications ทั้งหมด'],
                ['Audit Log', 'ประวัติการเข้าถึงข้อมูลของท่าน'],
              ].map(([label, desc]) => (
                <li key={label} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>
                    <strong>{label}</strong> — {desc}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Export form */}
          <form onSubmit={handleExport} className="px-6 py-5 space-y-5">
            {/* Format selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">รูปแบบไฟล์</p>
              <div className="grid grid-cols-2 gap-3">
                {([['json', 'JSON', FileJson, 'ข้อมูลครบถ้วน ครอบคลุม nested'],
                  ['csv', 'CSV', FileText, 'เปิดใน Excel ได้ทันที']] as const).map(
                  ([val, label, Icon, desc]) => (
                    <label
                      key={val}
                      className={[
                        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                        format === val
                          ? 'bg-blue-50 border-blue-400'
                          : 'bg-white border-gray-200 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={val}
                        className="sr-only"
                        checked={format === val}
                        onChange={() => setFormat(val)}
                      />
                      <Icon
                        className={`w-5 h-5 mt-0.5 ${format === val ? 'text-blue-600' : 'text-gray-400'}`}
                      />
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{label}</p>
                        <p className="text-[11px] text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ),
                )}
              </div>
            </div>

            {/* Password re-auth */}
            <div>
              <label
                htmlFor="export-password"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2"
              >
                <Lock className="w-3.5 h-3.5" />
                ยืนยันตัวตน — กรอกรหัสผ่านของท่าน
              </label>
              <input
                id="export-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
                autoComplete="current-password"
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                จำเป็นต้องยืนยันตัวตนเพื่อป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!password || isPending}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white h-11 text-sm font-semibold gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลัง Export…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export ข้อมูล ({format.toUpperCase()})
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
          การ Export ทุกครั้งจะถูกบันทึกลงใน Audit Log ตาม PDPA
          <br />
          หากพบปัญหา ติดต่อ dpo@sso.go.th หรือโทร 1506
        </p>
      </div>
    </div>
  )
}
