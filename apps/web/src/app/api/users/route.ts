import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { logServerAuditEvent } from '../../../lib/supabase/audit';
import { CreateUserSchema } from '@workflow/shared';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || null;
  const userAgent = request.headers.get('user-agent') || null;

  try {
    const supabase = await createClient();
    const {
      data: { user: actor },
    } = await supabase.auth.getUser();

    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = CreateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de usuario inválidos', details: validation.error.format() },
        { status: 400 },
      );
    }

    const { email, firstName, lastName, roleIds } = validation.data;

    // Crear cuenta de usuario en Supabase Auth
    const { data: createdUser, error: createError } = await supabase.auth.signUp({
      email,
      password: `Tmp#${Math.random().toString(36).slice(-8)}A1!`,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (createError || !createdUser.user) {
      return NextResponse.json(
        { error: createError?.message || 'Error al crear usuario' },
        { status: 400 },
      );
    }

    const newUserId = createdUser.user.id;

    // Asignar roles seleccionados
    const userRoles = roleIds.map((roleId) => ({
      user_id: newUserId,
      role_id: roleId,
      assigned_by: actor.id,
    }));

    const { error: rolesError } = await supabase.from('user_roles').insert(userRoles);
    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 400 });
    }

    // Registrar auditoría del servidor: CREATE_USER
    await logServerAuditEvent({
      userId: actor.id,
      module: 'users',
      entityType: 'user',
      entityId: newUserId,
      action: 'CREATE_USER',
      oldData: null,
      newData: {
        email,
        firstName,
        lastName,
        roles: roleIds,
      },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      userId: newUserId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Error interno al procesar el alta de usuario' },
      { status: 500 },
    );
  }
}
