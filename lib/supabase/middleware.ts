import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/lib/types/database'

// =============================================================================
// Route Access Configuration
// กำหนด roles ที่มีสิทธิ์เข้าถึงแต่ละ path
// =============================================================================

interface RouteRule {
  path: string
  roles: UserRole[]
  /** true = ต้องตรวจ role จริง ๆ (query DB), false = แค่ตรวจ auth */
  strictRoleCheck: boolean
}

const PROTECTED_ROUTES: RouteRule[] = [
  // /admin → admin เท่านั้น
  { path: '/admin', roles: ['admin'], strictRoleCheck: true },
  // /officer → officer และ admin
  { path: '/officer', roles: ['officer', 'admin'], strictRoleCheck: true },
  // /member → ทุก role (ตรวจแค่ว่า login อยู่)
  { path: '/member', roles: ['member', 'officer', 'admin'], strictRoleCheck: false },
]

const AUTH_PAGES = ['/login', '/register']

// Public paths ที่ไม่ต้อง intercept
const PUBLIC_PATH_PREFIXES = [
  '/api/auth/callback',
  '/api/health',
  '/privacy',
  '/terms',
  '/_next',
  '/favicon',
]

// =============================================================================
// Helpers
// =============================================================================

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'officer':
      return '/officer'
    default:
      return '/member'
  }
}

function getMatchedRoute(pathname: string): RouteRule | null {
  for (const route of PROTECTED_ROUTES) {
    if (pathname === route.path || pathname.startsWith(route.path + '/')) {
      return route
    }
  }
  return null
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function redirectTo(url: URL, pathname: string, params?: Record<string, string>): NextResponse {
  const redirectUrl = url.clone()
  redirectUrl.pathname = pathname
  redirectUrl.search = ''
  if (params) {
    Object.entries(params).forEach(([k, v]) => redirectUrl.searchParams.set(k, v))
  }
  return NextResponse.redirect(redirectUrl)
}

// =============================================================================
// Main middleware function
// =============================================================================

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ข้าม public paths เพื่อประหยัด latency
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request })
  }

  // สร้าง supabase response object ที่ sync cookies ได้ถูกต้อง
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // ต้อง set ทั้ง request และ response เพื่อให้ token refresh ทำงานถูกต้อง
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ตรวจสอบ session (validate JWT กับ Supabase server)
  // IMPORTANT: ต้องใช้ getUser() ไม่ใช่ getSession() เพื่อความปลอดภัย
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p))

  // -----------------------------------------------------------------------
  // Case 1: ผู้ใช้ login อยู่แล้ว แต่เข้า auth pages (/login, /register)
  // → redirect ไป dashboard ตาม role
  // -----------------------------------------------------------------------
  if (isAuthPage && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role ?? 'member') as UserRole
    return redirectTo(request.nextUrl, getDashboardPath(role))
  }

  // -----------------------------------------------------------------------
  // Case 2: Protected routes
  // -----------------------------------------------------------------------
  const matchedRoute = getMatchedRoute(pathname)

  if (matchedRoute) {
    // ยังไม่ได้ login → redirect to /login พร้อม next param
    if (!user) {
      return redirectTo(request.nextUrl, '/login', {
        next: encodeURIComponent(pathname),
      })
    }

    // ตรวจ role เฉพาะ routes ที่ต้องการ (officer, admin)
    if (matchedRoute.strictRoleCheck) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role ?? 'member') as UserRole

      if (!matchedRoute.roles.includes(role)) {
        // Role ไม่เพียงพอ → redirect ไป dashboard ของตัวเอง
        return redirectTo(request.nextUrl, getDashboardPath(role))
      }
    }
  }

  // -----------------------------------------------------------------------
  // Case 3: Root path → redirect ไป dashboard
  // -----------------------------------------------------------------------
  if (pathname === '/') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role ?? 'member') as UserRole
      return redirectTo(request.nextUrl, getDashboardPath(role))
    }
    return redirectTo(request.nextUrl, '/login')
  }

  return supabaseResponse
}
