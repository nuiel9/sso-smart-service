import type { User } from '@supabase/supabase-js'
import type { UserRole } from './database'

export interface AuthUser extends User {
  profile?: UserProfile
}

export interface UserProfile {
  id: string
  citizen_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
}

export interface LoginCredentials {
  phone: string
  otp?: string
}

export interface RegisterData {
  citizen_id: string
  first_name: string
  last_name: string
  phone: string
  email?: string
}

export interface AuthState {
  user: AuthUser | null
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
}
