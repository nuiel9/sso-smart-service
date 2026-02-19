import type { messagingApi } from '@line/bot-sdk'

// ---------------------------------------------------------------------------
// Brand colours
// ---------------------------------------------------------------------------

const NAVY = '#1e3a5f'
const GOLD = '#c9a84c'
const GREEN = '#2e7d32'
const RED = '#c62828'
const ORANGE = '#e65100'
const GRAY = '#78909c'

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  active: 'มีสิทธิ์',
  pending: 'รอดำเนินการ',
  expired: 'หมดอายุ',
  claimed: 'รับสิทธิ์แล้ว',
  not_eligible: 'ไม่มีสิทธิ์',
}

const STATUS_COLOR: Record<string, string> = {
  active: GREEN,
  pending: ORANGE,
  expired: RED,
  claimed: GRAY,
  not_eligible: GRAY,
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function headerBox(
  title: string,
  subtitle?: string
): messagingApi.FlexBox {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: NAVY,
    paddingAll: '16px',
    contents: [
      {
        type: 'text',
        text: title,
        color: '#ffffff',
        size: 'lg',
        weight: 'bold',
        wrap: true,
      },
      ...(subtitle
        ? [
            {
              type: 'text' as const,
              text: subtitle,
              color: '#ffffffaa',
              size: 'sm',
              wrap: true,
              margin: 'xs' as const,
            },
          ]
        : []),
    ],
  }
}

function footerButton(
  label: string,
  data: string
): messagingApi.FlexButton {
  return {
    type: 'button',
    action: {
      type: 'postback',
      label,
      data,
      displayText: label,
    },
    style: 'primary',
    color: NAVY,
    height: 'sm',
  }
}

function footerUri(label: string, uri: string): messagingApi.FlexButton {
  return {
    type: 'button',
    action: { type: 'uri', label, uri },
    style: 'primary',
    color: GOLD,
    height: 'sm',
  }
}

// ---------------------------------------------------------------------------
// 1. Welcome Message
// ---------------------------------------------------------------------------

export function welcomeMessage(): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    header: headerBox('ยินดีต้อนรับสู่ SSO Smart Service', 'สำนักงานประกันสังคม'),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: 'บริการที่ให้ได้ผ่าน LINE',
          weight: 'bold',
          color: NAVY,
          size: 'sm',
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            featureRow('🔍', 'ตรวจสอบสิทธิ์ประกันสังคม'),
            featureRow('💰', 'ดูสถานะการจ่ายเงินสมทบ'),
            featureRow('🤖', 'ถาม AI ผู้ช่วยตลอด 24 ชั่วโมง'),
            featureRow('🔔', 'รับการแจ้งเตือนอัตโนมัติ'),
          ],
        },
        {
          type: 'separator',
          margin: 'md',
        },
        {
          type: 'text',
          text: 'กด "เชื่อมบัญชี" เพื่อดูสิทธิ์ของคุณ',
          color: GRAY,
          size: 'xs',
          wrap: true,
          margin: 'sm',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        footerButton('เชื่อมบัญชี SSO', 'action=link_account'),
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ถาม AI ผู้ช่วย',
            data: 'action=chat',
            displayText: 'ถาม AI ผู้ช่วย',
          },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  }

  return { type: 'flex', altText: 'ยินดีต้อนรับสู่ SSO Smart Service', contents: bubble }
}

function featureRow(emoji: string, text: string): messagingApi.FlexBox {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    contents: [
      { type: 'text', text: emoji, flex: 0, size: 'sm' },
      { type: 'text', text, flex: 1, size: 'sm', color: '#424242', wrap: true },
    ],
  }
}

// ---------------------------------------------------------------------------
// 2. Benefits Summary (Carousel)
// ---------------------------------------------------------------------------

export interface BenefitItem {
  benefitType: string
  title: string
  status: string
  amount?: number | null
  expiryDate?: string | null
}

export function benefitsSummary(benefits: BenefitItem[]): messagingApi.FlexMessage {
  const bubbles: messagingApi.FlexBubble[] = benefits.slice(0, 10).map((b) => {
    const color = STATUS_COLOR[b.status] ?? GRAY
    const label = STATUS_LABEL[b.status] ?? b.status

    return {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: color,
        paddingAll: '12px',
        contents: [
          {
            type: 'text',
            text: b.title,
            color: '#ffffff',
            size: 'sm',
            weight: 'bold',
            wrap: true,
          },
          {
            type: 'text',
            text: label,
            color: '#ffffffcc',
            size: 'xs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        spacing: 'sm',
        contents: [
          ...(b.amount != null
            ? [
                {
                  type: 'text' as const,
                  text: `฿${b.amount.toLocaleString('th-TH')}`,
                  size: 'xl' as const,
                  weight: 'bold' as const,
                  color: NAVY,
                },
              ]
            : []),
          ...(b.expiryDate
            ? [
                {
                  type: 'text' as const,
                  text: `หมดอายุ: ${formatThaiDate(b.expiryDate)}`,
                  size: 'xs' as const,
                  color: GRAY,
                },
              ]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '8px',
        contents: [
          footerButton('รายละเอียด', `action=benefit_detail&type=${b.benefitType}`),
        ],
      },
    }
  })

  // Fallback if no benefits
  if (bubbles.length === 0) {
    bubbles.push({
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: 'ไม่พบข้อมูลสิทธิประโยชน์',
            color: GRAY,
            align: 'center',
          },
        ],
      },
    })
  }

  return {
    type: 'flex',
    altText: 'สรุปสิทธิประโยชน์ประกันสังคมของคุณ',
    contents: { type: 'carousel', contents: bubbles },
  }
}

// ---------------------------------------------------------------------------
// 3. Payment Status
// ---------------------------------------------------------------------------

export interface PaymentData {
  month: string  // e.g. "มกราคม 2568"
  wageAmount: number
  contributionAmount: number
  status: 'paid' | 'pending' | 'overdue'
  dueDate?: string
}

export function paymentStatus(data: PaymentData): messagingApi.FlexMessage {
  const statusConfig = {
    paid: { label: 'ชำระแล้ว', color: GREEN },
    pending: { label: 'รอชำระ', color: ORANGE },
    overdue: { label: 'เกินกำหนด', color: RED },
  }
  const { label, color } = statusConfig[data.status]

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    header: headerBox(`สถานะเงิน — ${data.month}`),
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'สถานะ', flex: 1, color: GRAY, size: 'sm' },
            {
              type: 'text',
              text: label,
              flex: 1,
              color,
              size: 'sm',
              weight: 'bold',
              align: 'end',
            },
          ],
        },
        { type: 'separator' },
        infoRow('ค่าจ้าง', `฿${data.wageAmount.toLocaleString('th-TH')}`),
        infoRow('เงินสมทบ (5%)', `฿${data.contributionAmount.toLocaleString('th-TH')}`),
        ...(data.dueDate
          ? [
              { type: 'separator' as const },
              infoRow('ครบกำหนด', formatThaiDate(data.dueDate)),
            ]
          : []),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [footerButton('ดูประวัติทั้งหมด', 'action=payment_history')],
    },
  }

  return {
    type: 'flex',
    altText: `สถานะเงินสมทบ — ${data.month}`,
    contents: bubble,
  }
}

function infoRow(label: string, value: string): messagingApi.FlexBox {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, flex: 1, color: GRAY, size: 'sm' },
      { type: 'text', text: value, flex: 1, size: 'sm', weight: 'bold', align: 'end' },
    ],
  }
}

// ---------------------------------------------------------------------------
// 4. PDPA Consent Request
// ---------------------------------------------------------------------------

export function consentRequest(): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    header: headerBox('นโยบายความเป็นส่วนตัว (PDPA)', 'สำนักงานประกันสังคม'),
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'สปส. จะเก็บรวบรวมและใช้ข้อมูลส่วนบุคคลของคุณ เพื่อ:',
          size: 'sm',
          wrap: true,
          color: '#424242',
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          margin: 'sm',
          contents: [
            consentItem('ตรวจสอบสิทธิประโยชน์ประกันสังคม'),
            consentItem('ส่งการแจ้งเตือนที่เกี่ยวข้อง'),
            consentItem('ปรับปรุงคุณภาพการให้บริการ'),
          ],
        },
        { type: 'separator', margin: 'md' },
        {
          type: 'text',
          text: 'ข้อมูลของคุณจะถูกเก็บรักษาอย่างปลอดภัยตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ.2562',
          size: 'xs',
          color: GRAY,
          wrap: true,
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ยอมรับ',
            data: 'action=pdpa_consent_accept',
            displayText: 'ฉันยอมรับนโยบายความเป็นส่วนตัว',
          },
          style: 'primary',
          color: GREEN,
          height: 'sm',
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ปฏิเสธ',
            data: 'action=pdpa_consent_decline',
            displayText: 'ฉันปฏิเสธนโยบายความเป็นส่วนตัว',
          },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  }

  return {
    type: 'flex',
    altText: 'กรุณายอมรับนโยบายความเป็นส่วนตัว (PDPA) เพื่อใช้บริการ',
    contents: bubble,
  }
}

function consentItem(text: string): messagingApi.FlexBox {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    contents: [
      { type: 'text', text: '•', flex: 0, size: 'sm', color: NAVY },
      { type: 'text', text, flex: 1, size: 'sm', color: '#424242', wrap: true },
    ],
  }
}

// ---------------------------------------------------------------------------
// 5. Escalation Notice
// ---------------------------------------------------------------------------

export function escalationNotice(reason?: string): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    header: headerBox('ส่งต่อเจ้าหน้าที่', 'AI ไม่สามารถตอบได้อย่างแน่ใจ'),
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: reason ??
            'ขอโทษด้วยครับ คำถามของคุณต้องการความชำนาญเฉพาะทาง ขอส่งต่อเจ้าหน้าที่เพื่อช่วยเหลือต่อไป',
          size: 'sm',
          wrap: true,
          color: '#424242',
        },
        { type: 'separator', margin: 'md' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                { type: 'text', text: 'สายด่วน สปส.', size: 'xs', color: GRAY },
                { type: 'text', text: '1506', size: 'xl', weight: 'bold', color: NAVY },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                { type: 'text', text: 'เวลาทำการ', size: 'xs', color: GRAY },
                { type: 'text', text: 'จ-ศ 7:00-19:00', size: 'sm', color: '#424242' },
              ],
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        footerUri('โทร 1506', 'tel:1506'),
        footerButton('กลับไปถาม AI', 'action=chat'),
      ],
    },
  }

  return {
    type: 'flex',
    altText: 'ส่งต่อเจ้าหน้าที่ สปส. — โทร 1506',
    contents: bubble,
  }
}

// ---------------------------------------------------------------------------
// Date helper
// ---------------------------------------------------------------------------

function formatThaiDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      calendar: 'buddhist',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}
