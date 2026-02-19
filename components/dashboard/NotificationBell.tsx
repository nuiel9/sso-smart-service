'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

interface Notification {
  id: string
  title: string
  description: string
  time: string
  read: boolean
}

export function NotificationBell() {
  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'สิทธิประโยชน์อนุมัติแล้ว',
      description: 'คำขอเบิกค่ารักษาพยาบาลของคุณได้รับการอนุมัติ',
      time: '10 นาทีที่แล้ว',
      read: false,
    },
    {
      id: '2',
      title: 'มีข้อความใหม่',
      description: 'เจ้าหน้าที่ตอบกลับข้อความของคุณแล้ว',
      time: '1 ชั่วโมงที่แล้ว',
      read: false,
    },
    {
      id: '3',
      title: 'อัปเดตข้อมูลสำเร็จ',
      description: 'ข้อมูลส่วนตัวของคุณถูกอัปเดตเรียบร้อยแล้ว',
      time: 'เมื่อวาน',
      read: true,
    },
  ])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>การแจ้งเตือน</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map((notification) => (
          <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3">
            <div className="flex items-center gap-2 w-full">
              {!notification.read && (
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
              <span className="font-medium text-sm">{notification.title}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{notification.description}</p>
            <span className="text-xs text-gray-400 mt-1">{notification.time}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-center text-blue-600 cursor-pointer">
          ดูทั้งหมด
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
