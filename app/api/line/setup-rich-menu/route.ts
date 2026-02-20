import { NextResponse } from 'next/server'
import { setupRichMenu, clearAllRichMenus } from '@/lib/line/rich-menu'

/**
 * POST /api/line/setup-rich-menu
 *
 * Sets up the LINE Rich Menu for all users.
 * Note: You still need to upload the Rich Menu image separately.
 */
export async function POST(request: Request) {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!token) {
      return NextResponse.json(
        { error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured' },
        { status: 500 }
      )
    }

    // Clear existing rich menus first
    await clearAllRichMenus(token)

    // Create new rich menu
    const richMenuId = await setupRichMenu(token)

    return NextResponse.json({
      success: true,
      richMenuId,
      message: 'Rich Menu created successfully',
      nextStep: `Upload image using: curl -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content -H "Authorization: Bearer ${token.substring(0, 20)}..." -H "Content-Type: image/png" --data-binary @rich-menu.png`,
    })
  } catch (error) {
    console.error('[LINE] Rich Menu setup error:', error)
    return NextResponse.json(
      { error: 'Failed to setup Rich Menu', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/line/setup-rich-menu
 *
 * Deletes all existing Rich Menus.
 */
export async function DELETE(request: Request) {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!token) {
      return NextResponse.json(
        { error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured' },
        { status: 500 }
      )
    }

    await clearAllRichMenus(token)

    return NextResponse.json({
      success: true,
      message: 'All Rich Menus deleted',
    })
  } catch (error) {
    console.error('[LINE] Rich Menu delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete Rich Menus', details: String(error) },
      { status: 500 }
    )
  }
}
