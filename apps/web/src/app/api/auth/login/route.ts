import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { logServerAuditEvent } from '../../../../lib/supabase/audit';
import { LoginSchema } from '@workflow/shared';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || null;
  const userAgent = request.headers.get('user-agent') || null;

  try {
    const body = await request.json();
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Credenciales inválidas o formato incorrecto' },
        { status: 400 },
      );
    }

    const { email, password } = validation.data;
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      // Registrar intento de inicio de sesión fallido
      await logServerAuditEvent({
        userId: null,
        module: 'auth',
        entityType: 'session',
        entityId: null,
        action: 'LOGIN_FAILED',
        oldData: null,
        newData: { email, reason: authError?.message || 'Invalid credentials' },
        ipAddress: ip,
        userAgent,
      });

      return NextResponse.json(
        { error: 'Credenciales incorrectas o usuario no registrado' },
        { status: 401 },
      );
    }

    // Verificar si el perfil está activo (is_active)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_active')
      .eq('id', authData.user.id)
      .single();

    if (profile && !profile.is_active) {
      // Cerrar sesión inmediatamente y auditar
      await supabase.auth.signOut();

      await logServerAuditEvent({
        userId: authData.user.id,
        module: 'auth',
        entityType: 'session',
        entityId: authData.user.id,
        action: 'LOGIN_FAILED',
        oldData: null,
        newData: { email, reason: 'account_deactivated' },
        ipAddress: ip,
        userAgent,
      });

      return NextResponse.json(
        { error: 'Su cuenta ha sido desactivada por un administrador del sistema.' },
        { status: 403 },
      );
    }

    // Registrar inicio de sesión exitoso
    await logServerAuditEvent({
      userId: authData.user.id,
      module: 'auth',
      entityType: 'session',
      entityId: authData.session?.user.id,
      action: 'LOGIN',
      oldData: null,
      newData: { email, aal: authData.session?.user.app_metadata?.aal || 'aal1' },
      ipAddress: ip,
      userAgent,
    });

    // Comprobar si requiere elevación AAL2 (MFA)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const requiresMfa = aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2';

    return NextResponse.json({
      success: true,
      requiresMfa,
    });
  } catch {
    return NextResponse.json(
      { error: 'Error interno en el servidor de autenticación' },
      { status: 500 },
    );
  }
}
