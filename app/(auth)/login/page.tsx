'use client'

import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">
            สำนักงานประกันสังคม
          </h1>
          <p className="text-gray-600 mt-2">
            SSO Smart Service Platform
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
