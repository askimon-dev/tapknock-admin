import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, isAuthenticated } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true, message: 'Logged out' });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}

export async function GET() {
  const auth = await isAuthenticated();
  return NextResponse.json({ authenticated: auth });
}
