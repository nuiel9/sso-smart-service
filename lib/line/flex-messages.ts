import type { FlexMessage, FlexBubble, FlexCarousel } from '@line/bot-sdk'

// =============================================================================
// Flex Message Templates for LINE
// =============================================================================

// ---------------------------------------------------------------------------
// Welcome Message
// ---------------------------------------------------------------------------
export function createWelcomeMessage(userName?: string): FlexMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1e3a5f',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: '🏛️ สำนักงานประกันสังคม',
          color: '#ffffff',
          size: 'lg',
          weight: 'bold',
        },
        {
          type: 'text',
          text: 'SSO Smart Service',
          color: '#94a3b8',
          size: 'sm',
          margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `สวัสดีครับ${userName ? ` คุณ${userName}` : ''} 👋`,
          weight: 'bold',
          size: 'lg',
        },
        {
          type: 'text',
          text: 'ผมเป็น AI ผู้ช่วยของสำนักงานประกันสังคม พร้อมให้บริการตลอด 24 ชั่วโมง',
          wrap: true,
          color: '#666666',
          size: 'sm',
          margin: 'md',
        },
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'text',
          text: 'สามารถถามได้เลย เช่น:',
          size: 'sm',
          color: '#888888',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '• "มาตรา 33 คืออะไร"', size: 'sm', color: '#1e3a5f' },
            { type: 'text', text: '• "เงินสมทบจ่ายเท่าไหร่"', size: 'sm', color: '#1e3a5f' },
            { type: 'text', text: '• "สิทธิ์กรณีว่างงาน"', size: 'sm', color: '#1e3a5f' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          action: {
            type: 'message',
            label: '🔍 ตรวจสอบสิทธิ์',
            text: 'ตรวจสอบสิทธิ์',
          },
          style: 'primary',
          color: '#1e3a5f',
        },
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📞 โทร 1506',
            uri: 'tel:1506',
          },
          style: 'secondary',
        },
      ],
    },
  }

  return {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ SSO Smart Service',
    contents: bubble,
  }
}

// ---------------------------------------------------------------------------
// Benefits Summary Card
// ---------------------------------------------------------------------------
export function createBenefitsSummary(benefits: {
  section: string
  activeBenefits: number
  expiringSoon: number
  totalContributions: number
}): FlexMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1e3a5f',
      paddingAll: '15px',
      contents: [
        {
          type: 'text',
          text: '📋 สิทธิประโยชน์ของคุณ',
          color: '#ffffff',
          weight: 'bold',
          size: 'lg',
        },
        {
          type: 'text',
          text: `ผู้ประกันตน มาตรา ${benefits.section}`,
          color: '#94a3b8',
          size: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                { type: 'text', text: String(benefits.activeBenefits), size: 'xxl', weight: 'bold', align: 'center', color: '#22c55e' },
                { type: 'text', text: 'สิทธิ์ใช้ได้', size: 'xs', color: '#888888', align: 'center' },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                { type: 'text', text: String(benefits.expiringSoon), size: 'xxl', weight: 'bold', align: 'center', color: benefits.expiringSoon > 0 ? '#f59e0b' : '#666666' },
                { type: 'text', text: 'ใกล้หมดอายุ', size: 'xs', color: '#888888', align: 'center' },
              ],
            },
          ],
        },
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            { type: 'text', text: 'เงินสมทบสะสม', size: 'sm', color: '#888888', flex: 2 },
            { type: 'text', text: `฿${benefits.totalContributions.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'end', flex: 1 },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: 'ดูรายละเอียดเพิ่มเติม',
            uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sso-smart.vercel.app'}/member/benefits`,
          },
          style: 'primary',
          color: '#1e3a5f',
        },
      ],
    },
  }

  return {
    type: 'flex',
    altText: 'สรุปสิทธิประโยชน์ประกันสังคม',
    contents: bubble,
  }
}

// ---------------------------------------------------------------------------
// Payment Status Card
// ---------------------------------------------------------------------------
export function createPaymentStatus(payment: {
  lastPaymentDate: string
  lastPaymentAmount: number
  totalThisYear: number
  pendingAmount?: number
}): FlexMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#059669',
      paddingAll: '15px',
      contents: [
        {
          type: 'text',
          text: '💰 สถานะการเงิน',
          color: '#ffffff',
          weight: 'bold',
          size: 'lg',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'รับเงินล่าสุด', size: 'sm', color: '#888888', flex: 2 },
            { type: 'text', text: payment.lastPaymentDate, size: 'sm', align: 'end', flex: 1 },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'จำนวน', size: 'sm', color: '#888888', flex: 2 },
            { type: 'text', text: `฿${payment.lastPaymentAmount.toLocaleString()}`, size: 'md', weight: 'bold', color: '#22c55e', align: 'end', flex: 1 },
          ],
        },
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            { type: 'text', text: 'รวมปีนี้', size: 'sm', color: '#888888', flex: 2 },
            { type: 'text', text: `฿${payment.totalThisYear.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'end', flex: 1 },
          ],
        },
        ...(payment.pendingAmount ? [{
          type: 'box' as const,
          layout: 'horizontal' as const,
          margin: 'md' as const,
          contents: [
            { type: 'text' as const, text: 'รอดำเนินการ', size: 'sm' as const, color: '#f59e0b', flex: 2 },
            { type: 'text' as const, text: `฿${payment.pendingAmount.toLocaleString()}`, size: 'sm' as const, color: '#f59e0b', align: 'end' as const, flex: 1 },
          ],
        }] : []),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: 'ดูประวัติทั้งหมด',
            uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sso-smart.vercel.app'}/member/payments`,
          },
          style: 'primary',
          color: '#059669',
        },
      ],
    },
  }

  return {
    type: 'flex',
    altText: 'สถานะการเงินประกันสังคม',
    contents: bubble,
  }
}

// ---------------------------------------------------------------------------
// Notification Card
// ---------------------------------------------------------------------------
export function createNotificationCard(notification: {
  title: string
  body: string
  type: 'benefit_reminder' | 'payment_status' | 'system'
  actionUrl?: string
}): FlexMessage {
  const typeConfig = {
    benefit_reminder: { emoji: '🎁', color: '#f59e0b' },
    payment_status: { emoji: '💳', color: '#22c55e' },
    system: { emoji: 'ℹ️', color: '#3b82f6' },
  }

  const config = typeConfig[notification.type]

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: config.emoji, size: 'xl' },
            {
              type: 'text',
              text: notification.title,
              weight: 'bold',
              size: 'md',
              margin: 'sm',
              flex: 1,
            },
          ],
        },
        {
          type: 'text',
          text: notification.body,
          wrap: true,
          size: 'sm',
          color: '#666666',
          margin: 'md',
        },
      ],
    },
    ...(notification.actionUrl ? {
      footer: {
        type: 'box' as const,
        layout: 'vertical' as const,
        contents: [
          {
            type: 'button' as const,
            action: {
              type: 'uri' as const,
              label: 'ดูรายละเอียด',
              uri: notification.actionUrl,
            },
            style: 'link' as const,
            color: config.color,
          },
        ],
      },
    } : {}),
  }

  return {
    type: 'flex',
    altText: notification.title,
    contents: bubble,
  }
}

// ---------------------------------------------------------------------------
// Section 40 Promotion Card
// ---------------------------------------------------------------------------
export function createSection40Promo(): FlexMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#7c3aed',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '🌟 แนะนำ', color: '#e9d5ff', size: 'sm' },
        { type: 'text', text: 'ประกันสังคม มาตรา 40', color: '#ffffff', size: 'xl', weight: 'bold', margin: 'sm' },
        { type: 'text', text: 'สำหรับแรงงานอิสระ', color: '#c4b5fd', size: 'sm', margin: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'เริ่มต้นเพียง 70 บาท/เดือน', weight: 'bold', size: 'lg', color: '#7c3aed' },
        {
          type: 'text',
          text: 'รับสิทธิประโยชน์:',
          size: 'sm',
          color: '#888888',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '✓ กรณีเจ็บป่วย 300 บาท/วัน', size: 'sm' },
            { type: 'text', text: '✓ กรณีทุพพลภาพ 500-1,000 บาท/เดือน', size: 'sm' },
            { type: 'text', text: '✓ กรณีเสียชีวิต 25,000 บาท', size: 'sm' },
            { type: 'text', text: '✓ เงินบำเหน็จชราภาพ', size: 'sm' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          action: {
            type: 'message',
            label: 'สมัครมาตรา 40',
            text: 'วิธีสมัครมาตรา 40',
          },
          style: 'primary',
          color: '#7c3aed',
        },
        {
          type: 'button',
          action: {
            type: 'message',
            label: 'ดูรายละเอียดเพิ่ม',
            text: 'มาตรา 40 มีสิทธิ์อะไรบ้าง',
          },
          style: 'secondary',
        },
      ],
    },
  }

  return {
    type: 'flex',
    altText: 'แนะนำประกันสังคม มาตรา 40',
    contents: bubble,
  }
}

// ---------------------------------------------------------------------------
// Contact Officer Card
// ---------------------------------------------------------------------------
export function createContactOfficerCard(): FlexMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '👨‍💼 ติดต่อเจ้าหน้าที่', weight: 'bold', size: 'lg' },
        {
          type: 'text',
          text: 'หากต้องการความช่วยเหลือเพิ่มเติม สามารถติดต่อได้ที่:',
          wrap: true,
          size: 'sm',
          color: '#666666',
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📞 สายด่วน 1506',
            uri: 'tel:1506',
          },
          style: 'primary',
          color: '#1e3a5f',
        },
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '🌐 เว็บไซต์ สปส.',
            uri: 'https://www.sso.go.th',
          },
          style: 'secondary',
        },
      ],
    },
  }

  return {
    type: 'flex',
    altText: 'ติดต่อเจ้าหน้าที่ สปส.',
    contents: bubble,
  }
}

// ---------------------------------------------------------------------------
// Quick Reply Helper
// ---------------------------------------------------------------------------
export const QUICK_REPLY_ITEMS = {
  type: 'items' as const,
  items: [
    { type: 'action' as const, action: { type: 'message' as const, label: 'ตรวจสอบสิทธิ์', text: 'ตรวจสอบสิทธิ์' } },
    { type: 'action' as const, action: { type: 'message' as const, label: 'สถานะเงิน', text: 'สถานะการเงิน' } },
    { type: 'action' as const, action: { type: 'message' as const, label: 'มาตรา 40', text: 'มาตรา 40 คืออะไร' } },
    { type: 'action' as const, action: { type: 'message' as const, label: 'โทร 1506', text: 'ติดต่อเจ้าหน้าที่' } },
  ],
}
