import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  XCircle,
  Wallet,
  TrendingUp,
  Calendar,
  Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// =============================================================================
// Types & Mock Data
// =============================================================================

interface Transaction {
  id: string
  type: 'income' | 'expense'
  category: string
  description: string
  amount: number
  status: 'completed' | 'pending' | 'failed'
  date: string
  reference?: string
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-001',
    type: 'income',
    category: 'เงินทดแทนกรณีเจ็บป่วย',
    description: 'เงินทดแทนการขาดรายได้ ประจำเดือน ม.ค. 2568',
    amount: 7500,
    status: 'completed',
    date: '2025-02-15',
    reference: 'SSO-2568-001234',
  },
  {
    id: 'TXN-002',
    type: 'income',
    category: 'เงินสงเคราะห์บุตร',
    description: 'เงินสงเคราะห์บุตร ประจำเดือน ก.พ. 2568',
    amount: 800,
    status: 'completed',
    date: '2025-02-10',
    reference: 'SSO-2568-001235',
  },
  {
    id: 'TXN-003',
    type: 'expense',
    category: 'เงินสมทบประกันสังคม',
    description: 'หักเงินสมทบ ม.33 ประจำเดือน ก.พ. 2568',
    amount: 750,
    status: 'completed',
    date: '2025-02-05',
    reference: 'CON-2568-005678',
  },
  {
    id: 'TXN-004',
    type: 'income',
    category: 'ค่ารักษาพยาบาล',
    description: 'เบิกค่ารักษาพยาบาล รพ.ศิริราช',
    amount: 3200,
    status: 'pending',
    date: '2025-02-18',
    reference: 'MED-2568-002345',
  },
  {
    id: 'TXN-005',
    type: 'expense',
    category: 'เงินสมทบประกันสังคม',
    description: 'หักเงินสมทบ ม.33 ประจำเดือน ม.ค. 2568',
    amount: 750,
    status: 'completed',
    date: '2025-01-05',
    reference: 'CON-2568-004567',
  },
  {
    id: 'TXN-006',
    type: 'income',
    category: 'เงินสงเคราะห์บุตร',
    description: 'เงินสงเคราะห์บุตร ประจำเดือน ม.ค. 2568',
    amount: 800,
    status: 'completed',
    date: '2025-01-10',
    reference: 'SSO-2568-001100',
  },
  {
    id: 'TXN-007',
    type: 'income',
    category: 'ค่ารักษาพยาบาล',
    description: 'เบิกค่ารักษาพยาบาล คลินิก',
    amount: 500,
    status: 'failed',
    date: '2025-01-20',
    reference: 'MED-2568-001999',
  },
]

const STATUS_CONFIG = {
  completed: { label: 'สำเร็จ', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending: { label: 'รอดำเนินการ', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  failed: { label: 'ไม่สำเร็จ', color: 'bg-red-100 text-red-700', icon: XCircle },
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

export default async function PaymentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name_th, section_type, sso_member_id')
    .eq('id', user.id)
    .single()

  // Calculate summary from mock data
  const totalIncome = MOCK_TRANSACTIONS
    .filter(t => t.type === 'income' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = MOCK_TRANSACTIONS
    .filter(t => t.type === 'expense' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  const pendingAmount = MOCK_TRANSACTIONS
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-4xl">
          <Link href="/member" className="p-2 -ml-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold">สถานะการจ่ายเงิน</h1>
            <p className="text-xs text-blue-200">ประวัติการรับ-จ่ายเงินประกันสังคม</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-5 space-y-4 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-xs text-green-100">รับเงิน (ปีนี้)</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(totalIncome)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs text-blue-100">สมทบ (ปีนี้)</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(totalExpense)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Balance & Pending */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-100">
                  <Wallet className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">ยอดรวมสุทธิ</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalIncome - totalExpense)}
                  </p>
                </div>
              </div>
              {pendingAmount > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">รอดำเนินการ</p>
                  <p className="text-lg font-semibold text-yellow-600">
                    {formatCurrency(pendingAmount)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contribution Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              สถานะเงินสมทบ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">156</p>
                <p className="text-xs text-gray-500">เดือนที่ส่ง</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">24</p>
                <p className="text-xs text-gray-500">เหลืออีก (บำนาญ)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">117,000</p>
                <p className="text-xs text-gray-500">ยอดสะสม (บาท)</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">ความคืบหน้าสู่บำนาญ (180 เดือน)</span>
                <span className="font-medium">87%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '87%' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                ประวัติการทำรายการ
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลด
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {MOCK_TRANSACTIONS.map((txn) => {
                const statusConfig = STATUS_CONFIG[txn.status]
                const StatusIcon = statusConfig.icon
                const isIncome = txn.type === 'income'

                return (
                  <div
                    key={txn.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className={`p-2 rounded-full ${isIncome ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {isIncome ? (
                        <ArrowDownLeft className={`w-4 h-4 ${isIncome ? 'text-green-600' : 'text-blue-600'}`} />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {txn.category}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{txn.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{formatDate(txn.date)}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConfig.color}`}>
                          <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`font-semibold ${isIncome ? 'text-green-600' : 'text-gray-700'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(txn.amount)}
                      </p>
                      {txn.reference && (
                        <p className="text-[10px] text-gray-400 font-mono">{txn.reference}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <Button variant="outline" className="w-full mt-4">
              ดูประวัติทั้งหมด
            </Button>
          </CardContent>
        </Card>

        {/* Bank Account Info */}
        <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white border-0">
          <CardContent className="p-4">
            <p className="text-xs text-slate-300 mb-2">บัญชีรับเงินสิทธิประโยชน์</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">ธนาคารกรุงไทย</p>
                <p className="text-lg font-mono tracking-wider">XXX-X-XX567-8</p>
              </div>
              <Button variant="secondary" size="sm" className="text-xs">
                แก้ไข
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="h-6" />
      </main>
    </div>
  )
}
