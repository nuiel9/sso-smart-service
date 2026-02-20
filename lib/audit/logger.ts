/**
 * Centralized Audit Logger — PDPA Compliance
 *
 * ใช้งานแทน logAuditAction ที่กระจายอยู่ทั่วโปรเจกต์
 * ทุก action สำคัญต้องผ่าน logAudit() เพื่อ:
 *   - PDPA compliance (บันทึกการเข้าถึงข้อมูลส่วนบุคคล)
 *   - Security monitoring
 *   - Forensic audit trail
 *
 * Design principles:
 *   - Never throws — audit failure ≠ request failure
 *   - Uses service role (bypass RLS) เพื่อรับประกันว่า log ถูกบันทึกเสมอ
 *   - Extracts IP / User-Agent จาก request headers อัตโนมัติ
 */

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type { Database } from '@/lib/types/database'

// =============================================================================
// Action constants — type-safe, autocomplete-friendly
// =============================================================================

export const AuditAction = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  PASSWORD_RESET: 'password_reset',
  REAUTHENTICATE: 'reauthenticate',

  // ── Personal data (PDPA-sensitive) ────────────────────────────────────────
  VIEW_PROFILE: 'view_profile',
  UPDATE_PROFILE: 'update_profile',
  ADMIN_VIEW_USER: 'admin_view_user',

  // ── PDPA ──────────────────────────────────────────────────────────────────
  PDPA_CONSENT_GRANTED: 'pdpa_consent_granted',
  PDPA_CONSENT_REVOKED: 'pdpa_consent_revoked',
  DATA_EXPORT: 'data_export',
  DATA_DELETE_REQUEST: 'data_delete_request',

  // ── Benefits ──────────────────────────────────────────────────────────────
  VIEW_BENEFITS: 'view_benefits',
  SUBMIT_CLAIM: 'submit_claim',
  BENEFIT_STATUS_CHANGE: 'benefit_status_change',

  // ── Chat ──────────────────────────────────────────────────────────────────
  CHAT_SESSION_START: 'chat_session_start',
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  CHAT_ESCALATED: 'chat_escalated',

  // ── Notifications ─────────────────────────────────────────────────────────
  NOTIFICATION_SENT: 'notification_sent',
  NOTIFICATION_READ: 'notification_read',
  ADMIN_SEND_NOTIFICATION: 'admin_send_notification',

  // ── Admin ─────────────────────────────────────────────────────────────────
  ADMIN_EXPORT_AUDIT: 'admin_export_audit',

  // ── System / Cron ─────────────────────────────────────────────────────────
  CRON_PREDICT_NOTIFICATIONS: 'cron_predict_notifications',
} as const

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction]

// =============================================================================
// Types
// =============================================================================

export interface AuditPayload {
  /** UUID ของผู้ใช้ — null หาก system/anonymous */
  userId: string | null
  /** ประเภทการกระทำ */
  action: AuditActionType | string
  /** ตาราง/ทรัพยากรที่เกี่ยวข้อง เช่น 'profiles', 'benefits' */
  resource: string
  /** Context เพิ่มเติม เช่น { resource_id, filters } */
  metadata?: Record<string, unknown>
  /** IP address ของ client */
  ipAddress?: string | null
  /** User-Agent string */
  userAgent?: string | null
}

// =============================================================================
// Internal — service-role client (ไม่ต้องการ cookies)
// =============================================================================

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('[audit] Supabase env vars missing')
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// =============================================================================
// Core — logAudit
// =============================================================================

/**
 * บันทึก audit event ลงฐานข้อมูล
 * เรียกได้จาก API routes, Server Actions, background jobs
 *
 * @example
 * await logAudit({
 *   userId: user.id,
 *   action: AuditAction.VIEW_PROFILE,
 *   resource: 'profiles',
 *   ipAddress: request.headers.get('x-forwarded-for'),
 *   userAgent: request.headers.get('user-agent'),
 *   metadata: { profile_id: targetId },
 * })
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('audit_logs').insert({
      user_id: payload.userId,
      action: payload.action,
      resource: payload.resource,
      metadata: payload.metadata ?? {},
      ip_address: payload.ipAddress ?? null,
      user_agent: payload.userAgent ?? null,
    })
  } catch (err) {
    // Audit failure ต้องไม่หยุดการทำงานหลัก — log ไป console เท่านั้น
    console.error('[audit] Failed to write log:', payload.action, err)
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * ดึง IP address และ User-Agent จาก Request object
 * ใช้ร่วมกับ API routes (NextRequest)
 */
export function extractRequestMeta(request: Request): {
  ipAddress: string | null
  userAgent: string | null
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : (request.headers.get('x-real-ip') ?? null)

  return {
    ipAddress,
    userAgent: request.headers.get('user-agent') ?? null,
  }
}

/**
 * logAudit สำหรับ Server Components — ดึง headers อัตโนมัติ
 * ใช้ `headers()` จาก next/headers (ต้องอยู่ใน request context)
 *
 * @example
 * // ใน Server Component
 * await logAuditFromServer({
 *   userId: user.id,
 *   action: AuditAction.VIEW_PROFILE,
 *   resource: 'profiles',
 * })
 */
export async function logAuditFromServer(
  payload: Omit<AuditPayload, 'ipAddress' | 'userAgent'>,
): Promise<void> {
  try {
    const headersList = await headers()
    const forwarded = headersList.get('x-forwarded-for')
    const ipAddress = forwarded
      ? forwarded.split(',')[0].trim()
      : (headersList.get('x-real-ip') ?? null)
    const userAgent = headersList.get('user-agent') ?? null
    await logAudit({ ...payload, ipAddress, userAgent })
  } catch {
    // headers() ไม่สามารถเรียกนอก request context ได้ — fallback ไม่ใส่ IP
    await logAudit(payload)
  }
}

/**
 * Convenience wrapper สำหรับ API Route handlers
 * รับ Request object โดยตรง
 */
export async function logAuditFromRequest(
  request: Request,
  payload: Omit<AuditPayload, 'ipAddress' | 'userAgent'>,
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(request)
  await logAudit({ ...payload, ipAddress, userAgent })
}
