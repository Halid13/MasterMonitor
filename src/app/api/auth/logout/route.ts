import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { captureSecurityEvents } from '@/services/securityEventCapture';

export async function POST(req: NextRequest) {
  const username = req.cookies.get('mm_user')?.value || 'unknown';
  const ipSource = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0';

  captureSecurityEvents.logoutEvent(username, ipSource);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('mm_auth', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
  res.cookies.set('mm_user', '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
  return res;
}
