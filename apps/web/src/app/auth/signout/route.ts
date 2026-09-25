import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { logServerAuditEvent } from '../../../lib/supabase/audit';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const ip = request.headers.get('x-forwarded-for') || null;
    const userAgent = request.headers.get('user-agent') || null;

    // Registrar evento de auditoría LOGOUT
    await logServerAuditEvent({
      userId: user.id,
      module: 'auth',
      entityType: 'session',
      entityId: user.id,
      action: 'LOGOUT',
      oldData: null,
      newData: { email: user.email },
      ipAddress: ip,
      userAgent,
    });
  }

  await supabase.auth.signOut();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/login`, {
    status: 302,
  });
}
