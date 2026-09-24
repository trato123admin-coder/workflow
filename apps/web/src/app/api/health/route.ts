import { NextResponse } from 'next/server';
import { APP_DEFAULTS } from '@workflow/shared';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
    defaults: APP_DEFAULTS,
  });
}
