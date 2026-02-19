'use client'

import { Card, CardContent } from '@/components/ui/card'

interface QuickAction {
  id: string
  title: string
  icon: string
  href: string
}

const actions: QuickAction[] = [
  {
    id: 'check-rights',
    title: 'ตรวจสอบสิทธิ์',
    icon: '🔍',
    href: '/member/rights',
  },
  {
    id: 'claim-benefit',
    title: 'ยื่นเบิกสิทธิ์',
    icon: '📝',
    href: '/member/claim',
  },
  {
    id: 'check-status',
    title: 'ติดตามคำร้อง',
    icon: '📊',
    href: '/member/status',
  },
  {
    id: 'find-hospital',
    title: 'ค้นหา รพ.',
    icon: '🏥',
    href: '/member/hospitals',
  },
  {
    id: 'contact',
    title: 'ติดต่อ สปส.',
    icon: '📞',
    href: '/member/contact',
  },
  {
    id: 'history',
    title: 'ประวัติ',
    icon: '📋',
    href: '/member/history',
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {actions.map((action) => (
        <Card
          key={action.id}
          className="hover:shadow-md transition-shadow cursor-pointer"
        >
          <CardContent className="p-4 text-center">
            <span className="text-3xl">{action.icon}</span>
            <p className="text-sm mt-2 text-gray-700">{action.title}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
