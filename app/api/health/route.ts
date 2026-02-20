import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  services: {
    database: 'up' | 'down'
    auth: 'up' | 'down'
    ai: 'up' | 'down'
  }
  latency: {
    database: number | null
    ai: number | null
  }
}

export async function GET() {
  const startTime = Date.now()
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'down',
      auth: 'down',
      ai: 'down',
    },
    latency: {
      database: null,
      ai: null,
    },
  }

  // Check Database
  try {
    const dbStart = Date.now()
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)
    status.latency.database = Date.now() - dbStart
    status.services.database = error ? 'down' : 'up'
  } catch {
    status.services.database = 'down'
  }

  // Check Auth
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.getSession()
    status.services.auth = error ? 'down' : 'up'
  } catch {
    status.services.auth = 'down'
  }

  // Check AI (Typhoon)
  try {
    const aiStart = Date.now()
    const response = await fetch('https://api.opentyphoon.ai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.TYPHOON_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    })
    status.latency.ai = Date.now() - aiStart
    status.services.ai = response.ok ? 'up' : 'down'
  } catch {
    status.services.ai = 'down'
  }

  // Determine overall status
  const allUp = Object.values(status.services).every((s) => s === 'up')
  const allDown = Object.values(status.services).every((s) => s === 'down')

  if (allDown) {
    status.status = 'unhealthy'
  } else if (!allUp) {
    status.status = 'degraded'
  }

  const httpStatus = status.status === 'unhealthy' ? 503 : 200

  return NextResponse.json(status, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store',
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  })
}
