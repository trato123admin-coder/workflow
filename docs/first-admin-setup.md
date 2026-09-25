# Procedimiento Seguro: Alta del Primer Administrador

Este documento describe el procedimiento para dar de alta al primer usuario con rol `ADMIN` (Superusuario) en los entornos de **Staging** y **Local**, sin registrar contraseñas ni secretos en el repositorio Git.

---

## 1. Principio de Seguridad
- Las contraseñas **NUNCA** se escriben en scripts SQL del repositorio ni en archivos versionados.
- La cuenta de usuario se genera primero a través de la interfaz de autenticación (o el Dashboard de Supabase) y luego se elevan sus privilegios mediante la asignación del rol `ADMIN`.

---

## 2. Procedimiento Paso a Paso

### Paso 1: Registrar el Usuario
1. En la aplicación web desplegada (o local), ingresa a la pantalla de login/registro (o en el Supabase Dashboard > **Authentication** > **Users** > **Add user**).
2. Crea el usuario ingresando el correo electrónico del administrador (por ejemplo, `admin@tuempresa.pe`) y una contraseña segura temporal.
3. El trigger de base de datos `on_auth_user_created` creará automáticamente su registro en la tabla `public.profiles`.

### Paso 2: Elevar al Rol `ADMIN` (Superusuario)
1. Ingresa al **SQL Editor** de Supabase en tu proyecto.
2. Ejecuta la siguiente consulta sustituyendo `'<CORREO_DEL_USUARIO>'` por el correo registrado en el Paso 1:

```sql
insert into public.user_roles (user_id, role_id)
select p.id, r.id
  from public.profiles p, public.roles r
 where p.email = '<CORREO_DEL_USUARIO>'
   and r.code = 'ADMIN'
on conflict (user_id, role_id) do nothing;
```

3. Verifica la asignación ejecutando:
```sql
select p.email, p.first_name, p.last_name, r.code as role, r.is_superuser
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id
 where p.email = '<CORREO_DEL_USUARIO>';
```
Debe retornar una fila con `role = ADMIN` y `is_superuser = true`.

---

## 3. Configuración de MFA Obligatorio
Dado que el rol `ADMIN` tiene la bandera `requires_mfa = true`:
1. Tras iniciar sesión por primera vez con su correo y contraseña, el sistema solicitará el enrolamiento de MFA TOTP (Google Authenticator, Microsoft Authenticator o Authy).
2. El usuario escanea el código QR y confirma con el código de 6 dígitos.
3. El usuario queda completamente habilitado con autenticación multifactor nivel `aal2`.
