import Link from 'next/link'
import {
  MessageCircle,
  ClipboardList,
  CreditCard,
  Bell,
  type LucideIcon,
} from 'lucide-react'

// =============================================================================
// Config
// =============================================================================

interface QuickAction {
  id: string
  line1: string
  line2: string
  icon: LucideIcon
  href: string
  tileBg: string
  iconColor: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'chat',
    line1: 'สอบถาม AI',
    line2: 'ผู้ช่วย',
    icon: MessageCircle,
    href: '/member#chat',
    tileBg: 'bg-blue-50 hover:bg-blue-100 active:bg-blue-200',
    iconColor: 'text-blue-600',
  },
  {
    id: 'benefits',
    line1: 'ตรวจสอบ',
    line2: 'สิทธิ์',
    icon: ClipboardList,
    href: '/member/benefits',
    tileBg: 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'payments',
    line1: 'สถานะ',
    line2: 'การจ่ายเงิน',
    icon: CreditCard,
    href: '/member/payments',
    tileBg: 'bg-violet-50 hover:bg-violet-100 active:bg-violet-200',
    iconColor: 'text-violet-600',
  },
  {
    id: 'notifications',
    line1: 'การ',
    line2: 'แจ้งเตือน',
    icon: Bell,
    href: '/member/notifications',
    tileBg: 'bg-orange-50 hover:bg-orange-100 active:bg-orange-200',
    iconColor: 'text-orange-600',
  },
]

// =============================================================================
// Component — Server Component (pure navigation, no client state needed)
// =============================================================================

export function QuickActions() {
  return (
    // Mobile-first: 2-col → 4-col on sm+
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {QUICK_ACTIONS.map(({ id, line1, line2, icon: Icon, href, tileBg, iconColor }) => (
        <Link
          key={id}
          href={href}
          className={[
            'flex flex-col items-center justify-center gap-2.5',
            'rounded-xl p-4 min-h-[88px]',
            'transition-all duration-150 active:scale-95',
            tileBg,
          ].join(' ')}
        >
          {/* Icon in a pill-shaped badge */}
          <div className="p-2.5 rounded-full bg-white/70 shadow-sm">
            <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.8} />
          </div>

          {/* Two-line label — tight on mobile */}
          <span className="text-xs font-medium text-center text-gray-700 leading-snug">
            {line1}
            <br />
            {line2}
          </span>
        </Link>
      ))}
    </div>
  )
}

