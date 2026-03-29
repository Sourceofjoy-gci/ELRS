import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const publicPaths = ['/', '/landing', '/login', '/register']
const AUTH_COOKIE = 'elri_auth_token'

async function getTokenPayload(token: string) {
  try {
    const secretKey = process.env.JWT_SECRET || 'changeme_secret_key_32_chars'
    const secret = new TextEncoder().encode(secretKey)
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(AUTH_COOKIE)?.value

  if (publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    if (pathname === '/login' || pathname === '/register') {
      if (token) {
        const payload = await getTokenPayload(token)
        if (payload) {
          return NextResponse.redirect(new URL('/dashboard/research', request.url))
        }
      }
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const payload = await getTokenPayload(token)
    if (!payload) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (pathname.startsWith('/dashboard/admin')) {
      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard/research', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
