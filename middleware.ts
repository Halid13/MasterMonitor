import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || pathname.startsWith('/api');
  const hasAuth = request.cookies.get('mm_auth');

  if (!isPublic && !hasAuth) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/login') && hasAuth) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/dashboard';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\.(?:png|jpg|jpeg|svg|gif|ico|css|js|map)$).*)'],
};
