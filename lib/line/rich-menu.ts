import { messagingApi } from '@line/bot-sdk'

const { MessagingApiClient } = messagingApi

// ---------------------------------------------------------------------------
// Rich Menu Layout (2500 × 843 px — standard LINE size)
//
//  ┌──────────────┬──────────────┬──────────────┐
//  │ตรวจสอบสิทธิ์ │  สถานะเงิน   │  AI ถามตอบ  │  ← row 1  (y: 0–421)
//  ├──────────────┼──────────────┼──────────────┤
//  │  แจ้งเตือน   │  มาตรา 40   │ ติดต่อ 1506 │  ← row 2  (y: 421–843)
//  └──────────────┴──────────────┴──────────────┘
//    col 1 (0–833)  col 2 (833–1666)  col 3 (1666–2500)
// ---------------------------------------------------------------------------

export const RICH_MENU_CONFIG: messagingApi.RichMenuRequest = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'SSO Smart Service — Main Menu',
  chatBarText: 'เมนูบริการ สปส.',
  areas: [
    // Row 1 — top
    {
      bounds: { x: 0, y: 0, width: 833, height: 421 },
      action: {
        type: 'postback',
        label: 'ตรวจสอบสิทธิ์',
        data: 'action=check_benefits',
        displayText: 'ตรวจสอบสิทธิ์ประกันสังคม',
      },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 421 },
      action: {
        type: 'postback',
        label: 'สถานะเงิน',
        data: 'action=payment_status',
        displayText: 'ดูสถานะเงินสมทบ',
      },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 421 },
      action: {
        type: 'postback',
        label: 'AI ถามตอบ',
        data: 'action=chat',
        displayText: 'ถาม AI ผู้ช่วย',
      },
    },
    // Row 2 — bottom
    {
      bounds: { x: 0, y: 421, width: 833, height: 422 },
      action: {
        type: 'postback',
        label: 'แจ้งเตือน',
        data: 'action=notifications',
        displayText: 'ดูการแจ้งเตือน',
      },
    },
    {
      bounds: { x: 833, y: 421, width: 834, height: 422 },
      action: {
        type: 'postback',
        label: 'มาตรา 40',
        data: 'action=section40',
        displayText: 'ข้อมูลมาตรา 40',
      },
    },
    {
      bounds: { x: 1667, y: 421, width: 833, height: 422 },
      action: {
        type: 'uri',
        label: 'ติดต่อ 1506',
        uri: 'tel:1506',
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Setup function — run once (e.g., via CLI script or admin panel)
// Uploads the rich menu and sets it as the default for all users.
// ---------------------------------------------------------------------------

export async function setupRichMenu(channelAccessToken: string): Promise<string> {
  const client = new MessagingApiClient({ channelAccessToken })

  // 1. Create the rich menu
  const { richMenuId } = await client.createRichMenu(RICH_MENU_CONFIG)
  console.log(`[LINE] Rich menu created: ${richMenuId}`)

  // 2. Set as default rich menu for all users
  await client.setDefaultRichMenu(richMenuId)
  console.log(`[LINE] Rich menu set as default: ${richMenuId}`)

  console.log('[LINE] ⚠️  Remember to upload a rich menu image via LINE Console or:')
  console.log(`  curl -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content \\`)
  console.log(`    -H "Authorization: Bearer <CHANNEL_ACCESS_TOKEN>" \\`)
  console.log(`    -H "Content-Type: image/png" \\`)
  console.log(`    --data-binary @rich-menu.png`)

  return richMenuId
}

/**
 * Delete all existing rich menus (useful for re-setup during development).
 */
export async function clearAllRichMenus(channelAccessToken: string): Promise<void> {
  const client = new MessagingApiClient({ channelAccessToken })
  const { richmenus } = await client.getRichMenuList()
  await Promise.all(richmenus.map((m) => client.deleteRichMenu(m.richMenuId)))
  console.log(`[LINE] Deleted ${richmenus.length} rich menu(s)`)
}

// ---------------------------------------------------------------------------
// CLI entry point — run with: npx ts-node -e "require('./lib/line/rich-menu').main()"
// Or: node -r @swc-node/register lib/line/rich-menu.ts
// ---------------------------------------------------------------------------

export async function main() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set')
    process.exit(1)
  }
  await clearAllRichMenus(token)
  const id = await setupRichMenu(token)
  console.log(`\nDone! Rich menu ID: ${id}`)
}
