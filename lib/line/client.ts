import { validateSignature, messagingApi } from '@line/bot-sdk'

const { MessagingApiClient } = messagingApi

// ---------------------------------------------------------------------------
// Singleton client (lazy init — avoids crashing at import if env is missing)
// ---------------------------------------------------------------------------

let _client: InstanceType<typeof MessagingApiClient> | null = null

function getClient(): InstanceType<typeof MessagingApiClient> {
  if (!_client) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')
    _client = new MessagingApiClient({ channelAccessToken: token })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Signature verification (called before any event processing)
// ---------------------------------------------------------------------------

export function verifyLineSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) {
    console.error('[LINE] LINE_CHANNEL_SECRET is not set')
    return false
  }
  try {
    return validateSignature(rawBody, secret, signature)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)))
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      console.error(`[LINE] Attempt ${attempt + 1} failed:`, err)
    }
  }
  throw lastErr
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type LineMessage = messagingApi.Message

/** ส่ง reply กลับไปยัง LINE ผ่าน replyToken (ใช้ได้ครั้งเดียว, ไม่เสีย quota) */
export async function replyMessage(
  replyToken: string,
  messages: LineMessage[]
): Promise<void> {
  await withRetry(() =>
    getClient().replyMessage({ replyToken, messages })
  )
}

/** ส่ง push message ไปยัง userId (เสีย quota) */
export async function pushMessage(
  userId: string,
  messages: LineMessage[]
): Promise<void> {
  await withRetry(() =>
    getClient().pushMessage({ to: userId, messages })
  )
}

/** ส่ง Flex Message ไปยัง userId */
export async function sendFlexMessage(
  userId: string,
  altText: string,
  contents: messagingApi.FlexContainer
): Promise<void> {
  await pushMessage(userId, [{ type: 'flex', altText, contents }])
}

/** ส่ง Flex Message ผ่าน replyToken */
export async function replyFlexMessage(
  replyToken: string,
  altText: string,
  contents: messagingApi.FlexContainer
): Promise<void> {
  await replyMessage(replyToken, [{ type: 'flex', altText, contents }])
}
