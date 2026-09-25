# Guía de Conexión y Despliegue en Staging

Esta guía detalla los pasos para conectar los tres servicios en sus planes gratuitos: **Supabase**, **Vercel** y **Render**.

---

## 1. Supabase (Staging)

1. **Crear Proyecto en Supabase:**
   - Inicia sesión en [Supabase Dashboard](https://supabase.com/dashboard).
   - Crea un nuevo proyecto llamado `workflow-staging`.
   - Selecciona la región más cercana (ej. São Paulo `sa-east-1` o Este de EE. UU. `us-east-1`).
   - Guarda la contraseña maestra de la base de datos en tu gestor de claves seguro.

2. **Aplicar Migraciones Iniciales:**
   - En tu terminal local (con Supabase CLI logueado):
     ```bash
     supabase link --project-ref <TU_PROJECT_REF_STAGING>
     supabase db push
     ```
   - Esto aplicará la migración inicial `supabase/migrations/20260924000000_initial_schema.sql` con las extensiones, el esquema `private`, `audit_logs`, `case_counters` y `job_queue`.

3. **Obtener Credenciales de API:**
   - En *Project Settings* > *API*:
     - `Project URL` (ej. `https://<ref>.supabase.co`)
     - `anon public` key
     - `service_role secret` key (¡NUNCA exponer en cliente!)

4. **Desactivar Registro Público de Usuarios (Obligatorio por Seguridad):**
   - En *Authentication* > *Providers* > *Email*:
     - Desactiva el interruptor **"Enable Email Signup"** (debe quedar en **OFF**).
     - El registro abierto está prohibido (`enable_signup = false` en `supabase/config.toml`). Los usuarios solo se dan de alta mediante invitación administrativa o provisión del equipo de seguridad.

---

## 2. Render (`services/engine`)

1. **Conectar Repositorio en Render:**
   - Inicia sesión en [Render Dashboard](https://dashboard.render.com).
   - Haz clic en **New +** > **Blueprint** (o **Web Service**).
   - Si usas Blueprint, selecciona el repositorio `https://github.com/trato123admin-coder/workflow`. Render detectará `render.yaml` automáticamente.
   - Si creas el servicio web manualmente:
     - **Name:** `workflow-engine-staging`
     - **Environment:** `Docker`
     - **Docker Context Directory:** `.` (raíz del monorepo)
     - **Dockerfile Path:** `services/engine/Dockerfile`
     - **Health Check Path:** `/healthz`
     - **Plan:** `Free`

2. **Configurar Variables de Entorno en Render:**
   - En la pestaña *Environment* del servicio en Render, agrega:
     ```env
     PORT=3001
     HOST=0.0.0.0
     NODE_ENV=production
     SUPABASE_URL=https://<TU_PROJECT_REF>.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=<TU_SUPABASE_SERVICE_ROLE_KEY>
     ENGINE_ALLOWED_ORIGINS=https://<TU_SUBDOMINIO>.vercel.app
     ```
3. **Verificar Despliegue:**
   - Una vez desplegado, Render te asignará una URL pública (ej. `https://workflow-engine-staging.onrender.com`).
   - Visita `https://workflow-engine-staging.onrender.com/healthz` en tu navegador. Debe responder:
     ```json
     {"status":"ok","uptime":...,"timestamp":"..."}
     ```

---

## 3. Vercel (`apps/web`)

1. **Importar Proyecto en Vercel:**
   - Inicia sesión en [Vercel Dashboard](https://vercel.com).
   - Haz clic en **Add New...** > **Project**.
   - Importa el repositorio de GitHub: `trato123admin-coder/workflow`.

2. **Configurar Directorio Raíz del Monorepo:**
   - En **Root Directory**, selecciona: `apps/web`.
   - Vercel detectará Next.js automáticamente.

3. **Configurar Variables de Entorno en Vercel:**
   - Agrega en la sección *Environment Variables*:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://<TU_PROJECT_REF>.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=<TU_SUPABASE_ANON_KEY>
     NEXT_PUBLIC_ENGINE_URL=https://<TU_ENGINE_URL>.onrender.com
     ```
   - *Nota de seguridad:* NUNCA configures `SUPABASE_SERVICE_ROLE_KEY` en Vercel.

4. **Desplegar y Verificar:**
   - Haz clic en **Deploy**.
   - Al finalizar, ingresa a la URL generada (ej. `https://workflow-web.vercel.app/health`).
   - La pantalla de diagnóstico debe mostrar el estado operativo del frontend y la información del entorno.
