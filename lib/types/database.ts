export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'member' | 'officer' | 'admin'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          citizen_id: string | null
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          role: UserRole
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          citizen_id?: string | null
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          role?: UserRole
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          citizen_id?: string | null
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          role?: UserRole
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      benefits: {
        Row: {
          id: string
          user_id: string
          benefit_type: string
          amount: number
          status: string
          requested_at: string
          processed_at: string | null
          processed_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          benefit_type: string
          amount: number
          status?: string
          requested_at?: string
          processed_at?: string | null
          processed_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          benefit_type?: string
          amount?: number
          status?: string
          requested_at?: string
          processed_at?: string | null
          processed_by?: string | null
        }
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          status: string
          created_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          created_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          created_at?: string
          closed_at?: string | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant' | 'officer'
          content: string
          confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant' | 'officer'
          content: string
          confidence?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'user' | 'assistant' | 'officer'
          content?: string
          confidence?: number | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          details: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
    }
  }
}
