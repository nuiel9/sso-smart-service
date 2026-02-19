import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LucideIcon } from 'lucide-react'
import type { BenefitStatus } from '@/lib/types/database'

// =============================================================================
// Props — รับข้อมูลจาก Server Component (member/page.tsx)
// =============================================================================

export interface BenefitsCardProps {
  benefitType: string       // 'illness' | 'unemployment' | 'old_age' | ...
  title: string
  description: string
  icon: LucideIcon
  status: BenefitStatus | 'not_eligible'
  amount?: number | null
  expiryDate?: string | null
  eligibleDate?: string | null
}

// =============================================================================
// Config
// =============================================================================

const STATUS_CONFIG: Record<
  BenefitStatus | 'not_eligible',
  { label: string; badgeClass: string; iconBg: string; iconColor: string }
> = {
  active: {
    label: 'พร้อมใช้',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-700',
  },
  pending: {
    label: 'รอดำเนินการ',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    iconBg: 'bg-yellow-50',
    iconColor: 'text-yellow-700',
  },
  expired: {
    label: 'หมดอายุ',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  claimed: {
    label: 'ใช้แล้ว',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
    iconBg: 'bg-gray-50',
    iconColor: 'text-gray-500',
  },
  not_eligible: {
    label: 'ไม่มีสิทธิ์',
    badgeClass: 'bg-gray-50 text-gray-400 border-gray-100',
    iconBg: 'bg-gray-50',
    iconColor: 'text-gray-400',
  },
}

// =============================================================================
// Helpers
// =============================================================================

/** คืน true ถ้าหมดอายุภายใน 30 วัน */
function isExpiringSoon(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false
  const diff = new Date(expiryDate).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

function formatThaiDate(dateStr: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    calendar: 'buddhist',
  }).format(new Date(dateStr))
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('th-TH').format(amount) + ' บาท'
}

// =============================================================================
// Component — Server Component (no 'use client' needed)
// =============================================================================

export function BenefitsCard({
  title,
  description,
  icon: Icon,
  status,
  amount,
  expiryDate,
}: BenefitsCardProps) {
  const config = STATUS_CONFIG[status]
  const expiringSoon = isExpiringSoon(expiryDate)
  const isNotEligible = status === 'not_eligible'
  const isExpired = status === 'expired'

  return (
    <Card
      className={[
        'transition-shadow',
        !isNotEligible && !isExpired ? 'hover:shadow-md' : '',
        expiringSoon ? 'ring-2 ring-yellow-300 ring-offset-1' : '',
        isNotEligible ? 'opacity-55' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CardContent className="p-4 space-y-3">
        {/* Icon + Badge row */}
        <div className="flex items-center justify-between gap-2">
          <div className={`p-2 rounded-lg ${config.iconBg} shrink-0`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <Badge variant="outline" className={`text-xs font-medium ${config.badgeClass}`}>
            {config.label}
          </Badge>
        </div>

        {/* Title + Description */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{title}</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
        </div>

        {/* Amount (active benefits with value) */}
        {amount != null && amount > 0 && status === 'active' && (
          <p className="text-xs font-semibold text-green-700">
            วงเงิน {formatAmount(amount)}
          </p>
        )}

        {/* Expiry warning — highlight in yellow */}
        {expiringSoon && expiryDate && (
          <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 flex items-center gap-1">
            <span>⚠️</span>
            <span>หมดอายุ {formatThaiDate(expiryDate)}</span>
          </p>
        )}

        {/* Regular expiry date (not urgent) */}
        {expiryDate && !expiringSoon && status === 'active' && (
          <p className="text-xs text-gray-400">ถึง {formatThaiDate(expiryDate)}</p>
        )}

        {/* Expired label */}
        {status === 'expired' && expiryDate && (
          <p className="text-xs text-red-400">หมดอายุ {formatThaiDate(expiryDate)}</p>
        )}
      </CardContent>
    </Card>
  )
}

