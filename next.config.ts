import type { NextConfig } from 'next'

// =============================================================================
// Security Headers — PDPA Compliance & Defense in Depth
// =============================================================================

// Supabase project URL (ใช้สร้าง CSP connect-src)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co'
const supabaseWs = supabaseUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')

// Content-Security-Policy
// - script-src: Next.js App Router ต้องการ 'unsafe-inline' + 'unsafe-eval' สำหรับ dev
// - style-src:  Tailwind ใช้ inline styles ตลอด
// - connect-src: Supabase REST + Realtime (WebSocket) + Typhoon LLM + LINE API
const isDev = process.env.NODE_ENV === 'development'

const cspDirectives = [
  `default-src 'self'`,
  // Next.js injects inline scripts — nonces ต้องการ Middleware เพิ่มเติม
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://line.me https://*.line-scdn.net https://*.supabase.co`,
  // Supabase REST, Storage, Realtime (wss), Typhoon, LINE
  [
    `connect-src 'self'`,
    supabaseUrl,
    supabaseWs,
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.opentyphoon.ai',
    'https://api.line.me',
    'https://api.thsms.com', // SMS provider placeholder
    isDev ? 'ws://localhost:*' : '',
  ]
    .filter(Boolean)
    .join(' '),
  `font-src 'self' data:`,
  `media-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`, // ป้องกัน clickjacking
  `frame-src 'none'`,
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
  `upgrade-insecure-requests`,
]

const contentSecurityPolicy = cspDirectives.join('; ')

const securityHeaders = [
  // ── ป้องกัน Clickjacking ──────────────────────────────────────────────────
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // ── ป้องกัน MIME sniffing ────────────────────────────────────────────────
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // ── บังคับ HTTPS (HSTS) ───────────────────────────────────────────────────
  // maxAge = 1 ปี, includeSubDomains, preload
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // ── Referrer Policy ──────────────────────────────────────────────────────
  // strict-origin-when-cross-origin: ส่ง origin เฉพาะ same-origin หรือ HTTPS→HTTPS
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // ── Permissions Policy ───────────────────────────────────────────────────
  // ปิด browser features ที่ไม่จำเป็น
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'bluetooth=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
    ].join(', '),
  },
  // ── X-DNS-Prefetch-Control ────────────────────────────────────────────────
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  // ── Content-Security-Policy ───────────────────────────────────────────────
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
]

// =============================================================================
// Next.js config
// =============================================================================

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // ใช้กับทุก routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // API routes — เพิ่ม CORS headers สำหรับ internal use
        source: '/api/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig

