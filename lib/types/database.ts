export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================
// Enum Types
// ============================================================

/** บทบาทของผู้ใช้งานในระบบ SSO Smart Service */
export type UserRole = 'member' | 'officer' | 'admin'

/** มาตราประกันสังคม */
export type SectionType = '33' | '39' | '40'

/** สถานะสิทธิประโยชน์ */
export type BenefitStatus = 'active' | 'pending' | 'expired' | 'claimed'

/** ช่องทางการสนทนา */
export type ChatChannel = 'web' | 'line' | 'tangrat'

/** บทบาทในการสนทนา */
export type MessageRole = 'user' | 'assistant' | 'system'

/** ประเภทการแจ้งเตือน */
export type NotificationType =
  | 'benefit_reminder'
  | 'payment_status'
  | 'section40_outreach'
  | 'system'

/** ช่องทางการแจ้งเตือน */
export type NotificationChannel = 'push' | 'line' | 'sms'

// ============================================================
// Database Schema
// ============================================================

export interface Database {
  public: {
    Tables: {
      /**
       * โปรไฟล์ผู้ใช้งาน เชื่อมกับ Supabase Auth (auth.users)
       * ข้อมูลส่วนบุคคลอ่อนไหว (national_id) เข้ารหัสตาม PDPA
       */
      profiles: {
        Row: {
          id: string
          national_id: string | null
          full_name_th: string | null
          full_name_en: string | null
          phone: string | null
          role: UserRole
          sso_member_id: string | null
          section_type: SectionType | null
          zone_id: string | null
          pdpa_consent: boolean
          pdpa_consent_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          national_id?: string | null
          full_name_th?: string | null
          full_name_en?: string | null
          phone?: string | null
          role?: UserRole
          sso_member_id?: string | null
          section_type?: SectionType | null
          zone_id?: string | null
          pdpa_consent?: boolean
          pdpa_consent_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          national_id?: string | null
          full_name_th?: string | null
          full_name_en?: string | null
          phone?: string | null
          role?: UserRole
          sso_member_id?: string | null
          section_type?: SectionType | null
          zone_id?: string | null
          pdpa_consent?: boolean
          pdpa_consent_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * สิทธิประโยชน์ของผู้ประกันตน
       * เช่น เงินทดแทน ค่ารักษาพยาบาล เงินชราภาพ
       */
      benefits: {
        Row: {
          id: string
          member_id: string
          benefit_type: string
          status: BenefitStatus
          amount: number | null
          eligible_date: string | null
          expiry_date: string | null
          claimed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          benefit_type: string
          status?: BenefitStatus
          amount?: number | null
          eligible_date?: string | null
          expiry_date?: string | null
          claimed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          benefit_type?: string
          status?: BenefitStatus
          amount?: number | null
          eligible_date?: string | null
          expiry_date?: string | null
          claimed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * Session การสนทนากับ AI Chatbot
       * รองรับหลายช่องทาง: เว็บ, LINE, Tangrat
       */
      chat_sessions: {
        Row: {
          id: string
          member_id: string
          channel: ChatChannel
          started_at: string
          ended_at: string | null
          satisfaction_score: number | null
        }
        Insert: {
          id?: string
          member_id: string
          channel?: ChatChannel
          started_at?: string
          ended_at?: string | null
          satisfaction_score?: number | null
        }
        Update: {
          id?: string
          member_id?: string
          channel?: ChatChannel
          started_at?: string
          ended_at?: string | null
          satisfaction_score?: number | null
        }
      }

      /**
       * ข้อความแต่ละรายการในการสนทนา
       * รวม metadata จาก AI เช่น confidence score และการส่งต่อเจ้าหน้าที่
       */
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: MessageRole
          content: string
          confidence_score: number | null
          escalated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: MessageRole
          content: string
          confidence_score?: number | null
          escalated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: MessageRole
          content?: string
          confidence_score?: number | null
          escalated?: boolean
          created_at?: string
        }
      }

      /**
       * การแจ้งเตือนถึงผู้ประกันตน
       * รองรับ Push notification, LINE, SMS
       */
      notifications: {
        Row: {
          id: string
          member_id: string
          type: NotificationType
          title: string
          body: string
          channel: NotificationChannel
          read: boolean
          sent_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          member_id: string
          type: NotificationType
          title: string
          body: string
          channel: NotificationChannel
          read?: boolean
          sent_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          type?: NotificationType
          title?: string
          body?: string
          channel?: NotificationChannel
          read?: boolean
          sent_at?: string
          read_at?: string | null
        }
      }

      /**
       * Audit log สำหรับ PDPA compliance
       * บันทึกทุกการเข้าถึงข้อมูลส่วนบุคคล (append-only)
       */
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource: string
          ip_address: string | null
          user_agent: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          // audit_logs เป็น append-only ไม่ควร update
          // แต่ยังคง Update type ไว้เพื่อ type compatibility
          id?: string
          user_id?: string | null
          action?: string
          resource?: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          created_at?: string
        }
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      get_current_user_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
      get_current_user_zone: {
        Args: Record<string, never>
        Returns: string
      }
      log_data_access: {
        Args: {
          p_user_id: string
          p_action: string
          p_resource: string
          p_metadata?: Json
        }
        Returns: void
      }
    }

    Enums: {
      user_role: UserRole
      section_type: SectionType
      benefit_status: BenefitStatus
      chat_channel: ChatChannel
      message_role: MessageRole
      notification_type: NotificationType
      notification_channel: NotificationChannel
    }
  }
}
