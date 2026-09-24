# Anexo v2.3 — Diseño visual (DocuAI) y almacenamiento de archivos

**Fecha:** 23 de septiembre de 2026
**Complementa:** `00-maestro`, `v2.1`, `v2.0`, `v1`
**Precedencia:** `00-maestro` > **este anexo** > `v2.1` > `v2.0` > `v1`
**Recurso incluido:** `docuai-mockups.png` → copiar a `docs/design/docuai-mockups.png`

---

# PARTE A — Diseño visual

## A.1 Cómo se usa la imagen de referencia

La imagen contiene 9 pantallas de la marca **DocuAI**. Se usa como **referencia de estilo, disposición y componentes**. **No es fuente de verdad** de datos, flujos ni nombres: sus datos de muestra son genéricos (por ejemplo "ABC SAC" o "Trámite Notarial") y no reflejan el dominio sucesorio. Ante cualquier diferencia con la especificación, **manda la especificación**; las diferencias conocidas están en A.4 y A.7.

- El agente debe **abrir la imagen** al construir cada pantalla y respetar su estructura y jerarquía visual.
- El nombre "DocuAI" y el logo son configurables (`general.app_name`, `general.logo`, ver `v2.1` §3.7). No van escritos en el código.

## A.2 Lenguaje visual observado y tokens

**Rasgos**: barra lateral oscura azul marino con el ítem activo resaltado en azul; fondo claro; tarjetas blancas con esquinas redondeadas y sombra suave; KPIs con icono, valor grande y variación respecto al mes anterior; barras de progreso; insignias (*badges*) de estado con color; gráficos de línea, barras y dona; tipografía **Inter**; botón primario azul lleno y secundario con borde.

**Regla:** todo color, tipografía y espaciado sale de **tokens (variables CSS)**, nunca de valores fijos en los componentes. Los temas (Claro, Oscuro, Corporativo, Personalizado) redefinen esos tokens desde Settings → Apariencia, con validación de contraste AA (`v2.1` §2).

| Token | Uso | Valor provisional* |
|---|---|---|
| `--color-sidebar-bg` | Barra lateral | azul marino oscuro |
| `--color-primary` | Botones, ítem activo, enlaces | azul |
| `--color-bg` / `--color-surface` | Fondo / tarjetas | gris muy claro / blanco |
| `--color-text` / `--color-text-muted` | Texto principal / secundario | ver nota de contraste (A.7 #10) |
| `--status-danger` | Vencido, por vencer, error | rojo |
| `--status-warning` | En proceso, alerta | naranja / ámbar |
| `--status-success` | Finalizado, correcto | verde |
| `--status-info` | En trámite, informativo | azul |
| `--status-waiting` | En espera | violeta |
| `--status-neutral` | Pendiente, sin iniciar | gris / amarillo suave |
| `--radius-md`, `--shadow-card`, `--font-sans` (Inter) | Forma y tipografía | según imagen |

\* Los valores exactos se toman de la imagen en la Fase 1A y se ajustan con el diseñador; no se inventan códigos hexadecimales sin contrastarlos.

**Los colores de estado no se asocian a etiquetas** ("En proceso" = naranja) sino a la **categoría semántica** del catálogo (`catalog_items.color` → token). Si el administrador crea un estado nuevo, elige la categoría y hereda su color.

## A.3 Navegación (barra lateral)

Los ítems se muestran **según permisos y módulos activos** (`v2.1` §3.5 y §3.8).

| Ítem (mockup) | Ítem final | Condición |
|---|---|---|
| Inicio | Inicio (dashboard según rol) | siempre |
| Casos / Mis casos | Casos (todos o asignados, según permiso) | `cases.read.*` |
| Clientes | **Personas** | `parties.read` / `cases.read.*` |
| — | **Entidades** (notarías, estudios, SUNARP) | `entities.read` |
| Documentos | Biblioteca documentaria | `documents.read` |
| Plantillas | Plantillas | `templates.manage` |
| **Reglas IA** | **Reglas documentales** (no son IA: son reglas deterministas) | `rules.manage` |
| Asistente IA | Asistente de documentos | `documents.generate` (y `module.ai` para las sugerencias de IA) |
| Reportes | Reportes | `reports.read` |
| Caja Chica | Caja Chica | `module.cash` y `cash.read` |
| Usuarios | Usuarios y roles | `users.manage` |
| Configuración | Configuración | `settings.manage` |
| — | Monitoreo | `monitoring.read` |

## A.4 Mapa de pantallas: qué se conserva y qué se ajusta

| # | Pantalla del mockup | Se conserva | Se ajusta o agrega | Fase |
|---|---|---|---|---|
| 1 | **Dashboard Administrador** | KPIs (total, en proceso, finalizados, vencidos, con variación mensual), evolución de casos, dona de estados, productividad por analista, resumen de caja, alertas | Definir un **diccionario de KPIs** con una sola fórmula por indicador (ver A.7 #4). Agregar widgets de `00-maestro` §5: embudo por proceso, trámites por vencer, casos sin abogado, documentos caducados. El widget de caja solo aparece con `module.cash` y `cash.read`. Distribución configurable por usuario (`user_preferences`) | 2, 5, 6 |
| 2 | **Dashboard Analista** (Gestor) | Saludo, KPIs personales, "Mis casos" con vistas Tarjetas / Lista / Kanban, filtro por modelo, buscador, tarjetas con vencimiento y avance | Bandeja "qué hago hoy" (documentos faltantes por persona, trámites observados, publicaciones en plazo); insignia de **confidencial**; el Kanban valida las compuertas de cierre al mover tarjetas; mostrar el motivo cuando un movimiento se bloquea | 2 |
| 3 | **Dashboard Caja Chica** | Saldo disponible, saldo por medio (efectivo/banco/tarjeta), ingresos vs egresos, distribución de saldo, últimos movimientos, arqueo | El "medio" corresponde a `cash_accounts.account_type`. Los movimientos **no se editan: se reversan** (`v2` §9). Agregar solicitudes pendientes, cierre de periodo, adjunto de soporte y vínculo opcional a caso. Aviso visible de MFA activo | 8 |
| 4 | **Asistente IA de Documentos** (5 pasos) | Stepper: seleccionar caso → recomendación → datos → vista previa → generar; recomendación con alternativas y "por qué"; vista previa con plantilla y versión | Ver A.7 #3. Funciona **primero en modo reglas** (Fase 4) y suma la IA después (Fase 7) | 4, 7 |
| 5 | **Detalle de Caso** | Cabecera con número, estado y acciones (Asignar, Editar, Cerrar caso); pestañas; información general; avance ponderado; tabla de procesos | Pestañas **Personas**, **Patrimonio** y **Trámites externos** (`00-maestro` §5); "Cerrar caso" respeta las compuertas y muestra qué bloquea; "Tiempo restante" en días útiles con feriados; prioridad desde catálogo | 2, 3 |
| 6 | **Biblioteca Documentaria** | Tabla con código, nombre, categoría, tipo, aplicabilidad, estado; filtros por pestañas; paginación | Ver A.7 #7 | 3 |
| 7 | **Configuración** | Menú lateral de Settings; selector de tema (Claro, Oscuro, Corporativo, Personalizado); colores principales; tipografía y tamaño; **vista previa en vivo** ("Mi Empresa") | Agregar pestañas faltantes (A.7 #8) | 1B |
| 8 | **Gestión de Usuarios** | Tabla de usuarios con correo, nombre, perfil, estado, acciones; botón "Nuevo usuario" | Ver A.7 #9 | 1A |
| 9 | **Vista móvil** | Tarjetas KPI, "Mis casos", barra de navegación inferior | Definir el resto de pantallas móviles (A.6) | Transversal |

## A.5 Inventario de componentes reutilizables

Se construyen **una sola vez** sobre shadcn/ui, con los tokens de A.2, y se revisan en una página interna `/design-system` (solo en desarrollo).

`AppShell` · `Sidebar` (por permisos) · `Topbar` (búsqueda global Ctrl+K, notificaciones, perfil) · `KpiCard` (icono, valor, variación) · `CaseCard` (estado, título, cliente, vencimiento en días, avance, documentos pendientes, acción) · `StatusBadge` (color desde catálogo, icono + texto) · `ProgressBar` · `DataTable` (filtros, orden, paginación, columnas configurables, vista tarjetas en móvil) · `Tabs` · `Stepper` · `KanbanBoard` · gráficos con Recharts (`LineChart`, `BarChart`, `DonutChart`) · `Timeline` · `FormField` dinámico (campos personalizados y catálogos) · `FileUploader` (arrastrar, cámara, compresión) · `PdfPreview` · `MoneyInput` · `ToggleWithUsage` ("En uso (N)") · `ConfirmImpactDialog` · `ThemePicker` · `EmptyState` · `Skeleton` de carga.

## A.6 Responsive

| Ancho | Comportamiento |
|---|---|
| Móvil (< 768 px) | Barra lateral → **barra de navegación inferior** (Inicio, Casos, Documentos, Más); tablas → tarjetas; Kanban con desplazamiento horizontal; asistentes en pantalla completa; áreas táctiles ≥ 44 px |
| Tableta (768–1199 px) | Barra lateral colapsada a iconos; rejillas de 2 columnas |
| Escritorio (≥ 1200 px) | Diseño de la imagen |

Pantallas móviles a diseñar además del dashboard: **detalle de caso**, **lista de documentos**, **subir documento con la cámara** (los gestores escanean con el celular: convertir a PDF y comprimir en el cliente, ver B.5), **notificaciones** y **aprobación de documentos** para el abogado.

## A.7 Ajustes recomendados al diseño

| # | Observación | Ajuste |
|---|---|---|
| 1 | Los datos de muestra son genéricos (empresa cliente, "Trámite Notarial") | Las pantallas se construyen con el dominio de `00-maestro`: personas naturales, causante, herederos, patrimonio, trámites externos |
| 2 | Ítem "Reglas IA" | Renombrar a **"Reglas documentales"**: son reglas deterministas; la IA es una capa opcional posterior |
| 3 | Asistente: "96 % de coincidencia" y alternativas con 72 / 34 / 21 % | No son probabilidades. Mostrar **"Puntuación"** calculada por el sistema (regla + aceptación histórica + completitud, `v2` §7.3), nunca una "confianza" declarada por el modelo. Etiquetar "Sugerencia para revisión legal". Mostrar el **por qué** (regla aplicada, casos similares) y los **campos faltantes**. La vista previa lleva marca de agua BORRADOR hasta su aprobación |
| 4 | Cifras inconsistentes entre tarjetas y gráficos (p. ej. finalizados en KPI vs. porcentaje de la dona) | Definir un **diccionario de KPIs** con fórmula única en `packages/shared` (vencido = fecha límite pasada y caso no finalizado; en proceso = categoría `ACTIVE`, etc.). Todos los widgets consumen esas definiciones |
| 5 | En el detalle de caso, el ítem activo del menú es "Usuarios" | Debe resaltar **Casos**. Revisar el estado activo de la navegación |
| 6 | "Reportes" aparece dos veces en el menú del Asistente IA | Corregir |
| 7 | Biblioteca: columna "Tipo" mezcla Generado y Requerido; "Aplicabilidad: Ambos" | "Requerido / Alternativo" es propiedad de la **relación con el modelo** (`case_model_documents`), no del tipo. La biblioteca muestra **naturaleza** (Generado, Subido, Externo), **ámbito** (Caso, Persona, Bien) y **tipos de persona aplicables** (Natural, Jurídica o ambos). Filtros: Todos, Plantillas, Subidos, Externos, Activos. Lo obligatorio/alternativo se edita en la pestaña de documentos del modelo |
| 8 | Settings incompleto | Agregar: **Catálogos**, **Campos personalizados**, **Roles y permisos**, **Seguridad**, **Almacenamiento**, **Avanzado** (exportar/importar); "Horarios" pasa a Alertas (horario laboral y feriados); mantener Monedas y Módulos |
| 9 | Usuarios: tabla básica | Agregar columnas **MFA (activo/inactivo)**, último acceso y casos asignados; múltiples roles; acciones: desactivar, restablecer MFA, cerrar sesiones. Incluir el rol **Abogado** |
| 10 | Texto secundario gris y pequeño en tarjetas y tablas | Probablemente no cumple contraste AA. Tamaño mínimo 12–13 px, verificar contraste en Playwright + axe, e **insignias con icono + texto** (no depender solo del color) |
| 11 | Solo un ejemplo móvil | Ver A.6 |
| 12 | Tema Oscuro solo mencionado | Definir tokens oscuros completos y probarlos en las pantallas clave |

## A.8 Reglas de implementación del diseño

1. Tokens en `apps/web/styles/tokens.css` (o `packages/ui`), tema por atributo `data-theme`; los cambios de Settings actualizan las variables sin recompilar.
2. Ninguna pantalla usa colores o tamaños escritos a mano.
3. Pruebas visuales (capturas con Playwright) de las pantallas 1, 2, 5 y 8 en escritorio y móvil, comparadas con la imagen de referencia.
4. axe en CI sin errores críticos.
5. Estados vacíos, de carga y de error en **todas** las listas y paneles.
6. Textos en español (es-PE) desde i18n.

**Prompt de arranque — Sistema de diseño (dentro de la Fase 1A)**

```text
Lee AGENTS.md, docs/01-anexo-diseno-almacenamiento.md (Parte A) y abre docs/design/docuai-mockups.png.
Objetivo: Sistema de diseño base, dentro de la Fase 1A, en la rama feat/fase-1a-diseno. Presenta el plan y espera aprobación.
Implementa: tokens CSS (A.2) con temas Claro y Oscuro por data-theme; los componentes de A.5 (AppShell, Sidebar por permisos, Topbar con búsqueda global,
KpiCard, CaseCard, StatusBadge desde catálogo, DataTable, Tabs, Stepper, FormField dinámico, EmptyState, Skeleton);
la página /design-system solo en desarrollo; navegación de A.3; comportamiento responsive de A.6 (barra inferior en móvil);
pantallas 8 (Usuarios) y el login usando esos componentes.
Criterio de aceptación: capturas Playwright de escritorio y móvil coinciden con la estructura del mockup; axe sin errores críticos; ningún color escrito a mano.
```

---

# PARTE B — Almacenamiento de archivos

## B.1 Aclaración previa

En Supabase, los **archivos de Storage no consumen el espacio de la base de datos**: son cuotas distintas. El plan gratuito ofrece del orden de **500 MB de base de datos y 1 GB de archivos** (verificado el 23-sep-2026; confirmar antes de decidir). Lo que satura la base de datos son los datos de las tablas, no los PDF. Regla: **nunca guardar archivos en la base de datos** (ni como `bytea` ni en base64); en las tablas solo van metadatos y la ruta.

El problema real es que **1 GB de archivos alcanza para pocos casos**. Estimación a validar con escaneos reales: un caso sucesorio con ~35 documentos ocupa entre **20 y 70 MB**.

| Almacén | Capacidad libre | Casos aproximados |
|---|---|---|
| Supabase Storage (gratis) | 1 GB | 15 – 50 |
| Cloudflare R2 (gratis) | 10 GB | 150 – 500 |
| Google Drive (cuenta gratuita) | 15 GB, **compartidos con Gmail y Fotos** | 200 – 700 |

## B.2 Evaluación: Google Drive como almacén principal

**Recomendación: no usar Drive como almacén principal de los expedientes. Sí usarlo como destino de respaldo cifrado.**

| Aspecto | Problema con Drive como almacén principal |
|---|---|
| **Control de acceso** | Se pierde la seguridad por fila (RLS), las URLs firmadas de corta duración y la auditoría de descargas. Todo acceso tendría que pasar por un proxy del `engine`, y cualquiera con acceso a la carpeta de Drive **puede saltarse la aplicación y su auditoría** |
| **Cuenta gratuita y propiedad** | Los 15 GB se comparten con correo y fotos. Todos los expedientes dependen de **una cuenta y de una persona**: suspensión, pérdida de acceso o salida de esa persona significan perder el archivo del negocio |
| **Datos sensibles en cuenta personal** | Documentos de identidad, partidas y datos de menores dentro de una cuenta personal: riesgo frente a la Ley 29733 y al secreto profesional. Para uso empresarial corresponde una cuenta de **Google Workspace** con sus condiciones de servicio |
| **Autenticación técnica** | Las cuentas de servicio **no tienen cuota de almacenamiento propia utilizable** (errores `storageQuotaExceeded` documentados); solo funcionan bien con unidades compartidas de Workspace. Con una cuenta gratuita hay que usar **OAuth con un token de actualización del propietario** |
| **Caducidad de tokens** | Si la pantalla de consentimiento de OAuth queda en modo "Testing", los tokens **caducan a los 7 días** y el sistema deja de guardar archivos sin aviso. Hay que publicarla en producción; con el alcance `drive.file` (solo ve lo que la app creó) no requiere verificación de Google, según la documentación consultada |
| **Consistencia** | Dos sistemas (BD y Drive) pueden desincronizarse si alguien mueve o borra archivos desde la interfaz de Drive |
| **Rendimiento en plan gratuito** | Cada descarga tendría que pasar en *streaming* por Render gratuito (se duerme y tiene poca memoria) |
| **Límites de la API** | Cuotas por proyecto/usuario y un tope de subida diario alto (~750 GB/día por cuenta); no es el problema principal |

**Lo que sí aporta Drive:** espacio gratuito grande, interfaz conocida y una copia **fuera** de Supabase (que en el plan gratuito **no incluye backups de Storage**). Ese es su mejor uso: **respaldo**.

## B.3 Alternativas comparadas

| Opción | Ventajas | Desventajas | Uso recomendado |
|---|---|---|---|
| **Supabase Storage** | RLS y URLs firmadas nativas; sin servicios extra | Solo 1 GB gratis | **Inicio y piloto** (con datos de prueba) |
| **Cloudflare R2** (compatible con S3) | 10 GB gratis, **sin costo de salida de datos**, API S3 | Sin RLS (el `engine` genera URLs prefirmadas cortas); según la guía consultada, **suele pedir un método de pago** para activarlo aunque no cobra dentro del nivel gratuito | **Producción de bajo costo** cuando el 1 GB no alcance |
| **Google Drive** | 15 GB, familiar | Ver B.2 | **Solo respaldo cifrado** |
| **Supabase Pro** | Más espacio y backups de base de datos | Costo mensual | Cuando haya datos reales y presupuesto |

## B.4 Decisión de arquitectura: capa `StorageProvider`

Para no quedar atados a ningún proveedor, todo acceso a archivos pasa por una **interfaz** en el `engine`. Cambiar de almacén (Supabase → R2 → Supabase Pro) deja de ser una reescritura.

```ts
interface StorageProvider {
  put(key: string, body: Readable, meta: { mime: string; sha256: string; size: number }): Promise<void>;
  get(key: string): Promise<Readable>;              // lectura en streaming
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;  // no aplica a gdrive
}
// Implementaciones: SupabaseStorageProvider · S3StorageProvider (R2 u otro compatible) · GDriveBackupProvider (solo put/get para respaldo)
```

**Datos**

```sql
create table storage_backends (
  code        text primary key,                 -- 'supabase', 'r2', 'gdrive_backup'
  kind        text not null check (kind in ('supabase','s3','gdrive')),
  is_primary  boolean not null default false,
  is_backup   boolean not null default false,
  is_active   boolean not null default true,    -- TOGGLE
  config      jsonb not null default '{}'       -- bucket, endpoint, folder_id (SIN secretos)
);
-- Un solo backend primario activo (índice único parcial en is_primary)

alter table document_versions
  add column storage_backend text not null references storage_backends(code),
  add column storage_key     text not null,     -- reemplaza al "path"
  add column size_bytes      bigint not null,
  add column mime_type       text not null,
  add column sha256          text not null,
  add column backed_up_at    timestamptz,
  add column backup_ref      text;
```

- Cada versión **recuerda en qué backend está**, así que se puede migrar sin detener el sistema (lectura dual).
- El trabajo `storage_migrate(origen, destino)` copia los archivos, **verifica el `sha256`**, cambia el puntero y conserva el original unos días antes de purgarlo.
- El acceso siempre pasa por el `engine`: URL firmada de 60 s (Supabase) o prefirmada de 60 s (S3/R2). Se mantienen la auditoría de descargas y `can_access_case`.
- Los secretos (claves de R2, token de Drive) van **solo en variables de entorno**.

**Parámetros y toggles nuevos** (Settings → Almacenamiento)

| Clave | Función | Inicial |
|---|---|---|
| `storage.primary_backend` | Almacén principal | `supabase` |
| `storage.backup_backend` | Destino del respaldo (`none` / `gdrive_backup` / `r2`) | `none` hasta Fase 5 |
| `storage.max_file_mb` | Tamaño máximo por archivo | 10 |
| `storage.allowed_mime` | Tipos permitidos | PDF, DOCX, JPG, PNG |
| `storage.image_max_px` | Lado máximo de imágenes al subir | 2000 |
| `storage.usage_warn_percent` | Aviso de espacio usado | 80 |
| `storage.draft_retention_days` | Días que se conservan borradores no aprobados | 30 |
| Flag `storage.compress_uploads` | Comprimir antes de subir | ON |
| Flag `storage.backup_enabled` | Respaldo automático | OFF hasta Fase 5 |
| Flag `storage.backup_encrypt` | Cifrado del respaldo | ON y **bloqueado** si el destino es Drive |

La pantalla de almacenamiento muestra el uso por backend (`SUM(size_bytes)`) y el porcentaje de la cuota, con alerta al superar el umbral.

## B.5 Cómo ahorrar espacio (aplica a cualquier almacén)

1. **Comprimir en el navegador antes de subir**: imágenes a ≤ `storage.image_max_px`, JPEG/WebP calidad ~80; las fotos del celular se convierten a **PDF** (varias páginas por documento).
2. Límite de **10 MB** por archivo (ajustable).
3. **No guardar vistas previas**: se generan al vuelo (o con TTL de 24 h y limpieza automática).
4. Conservar de los documentos generados solo las versiones **aprobadas** (Word + PDF); los borradores no aprobados se purgan pasados `draft_retention_days`.
5. **Deduplicar** por `sha256` (el mismo archivo subido dos veces se guarda una vez).
6. Optimizar PDF escaneados (`docs.pdf_optimize`, opcional).

## B.6 Respaldo cifrado hacia Google Drive (Fase 5)

Trabajo nocturno `backup_storage`, incremental y reanudable:

1. Selecciona `document_versions` con `backed_up_at is null`.
2. Descarga cada archivo del almacén principal **en streaming**, de uno en uno (memoria limitada en Render gratuito).
3. **Lo cifra** con AES-256-GCM antes de subirlo. La clave vive en `BACKUP_ENC_KEY` (variable de entorno) y **además se guarda fuera de línea** en un gestor de contraseñas; sin la clave, el respaldo no se puede leer.
4. Lo sube a la carpeta creada por la aplicación: `/Respaldo/{año}/{n.º de caso}/{sha256}.enc`, junto con un manifiesto cifrado que mapea cada archivo.
5. Marca `backed_up_at` y `backup_ref`.
6. Semanalmente hace lo mismo con un `pg_dump` cifrado de la base de datos.

**Configuración de Google:** proyecto propio en Google Cloud, Drive API habilitada, cliente OAuth, pantalla de consentimiento **publicada en producción** (no "Testing"), alcance `drive.file`. Idealmente con una cuenta de **Workspace de la empresa** (los tokens de aplicaciones internas no caducan). El estado del token se vigila en `service_health_checks` y una falla genera alerta.

**Restauración:** script `restore` que descifra y repone archivos y base de datos; **debe probarse en staging** antes de confiar en el respaldo. Al estar cifrado, Drive solo almacena texto ininteligible: se reduce el riesgo de confidencialidad, aunque no reemplaza las obligaciones de protección de datos.

## B.7 Cambios a fases y criterios de aceptación

| Fase | Cambio |
|---|---|
| **3** | Interfaz `StorageProvider` + implementación Supabase; límites, compresión en cliente, deduplicación, `storage_backends` y campos nuevos de `document_versions` |
| **5** | Respaldo cifrado a Drive (o R2) con restauración probada; vigilancia de espacio |
| **9** | Ensayo de migración `storage_migrate` (Supabase → R2 o → Supabase Pro) con verificación de hashes |

- [ ] Ningún archivo se guarda en tablas de la base de datos.
- [ ] Cambiar `storage.primary_backend` no requiere modificar código de negocio.
- [ ] Una migración entre almacenes verifica el `sha256` de cada archivo antes de cambiar el puntero.
- [ ] El respaldo en Drive está cifrado y una restauración de prueba en staging recupera un caso completo.
- [ ] El sistema avisa al 80 % de uso del almacén principal.
- [ ] Las descargas siguen auditadas y con URL de 60 s, sea cual sea el backend.

**Prompt de arranque — Almacenamiento (Fase 3)**

```text
Lee AGENTS.md y docs/01-anexo-diseno-almacenamiento.md (Parte B).
Objetivo: capa de almacenamiento dentro de la Fase 3, rama feat/fase-3-storage. Presenta el plan y espera aprobación.
Implementa: interfaz StorageProvider en services/engine con SupabaseStorageProvider; tabla storage_backends y los campos nuevos de document_versions;
descargas por URL firmada de 60 s auditadas; compresión de imágenes y conversión de fotos a PDF en el navegador; límites por parámetros de Settings;
deduplicación por sha256; pantalla de uso de almacenamiento con aviso al 80 %.
No implementes todavía el respaldo a Drive (Fase 5). Ningún archivo va a la base de datos. Ningún secreto en el código.
Criterio de aceptación: subir, versionar y descargar documentos; el backend se cambia por parámetro sin tocar la lógica de negocio.
```

## B.8 Preguntas abiertas

| # | Pregunta | Por qué importa |
|---|---|---|
| S1 | La cuenta de Google que se usaría, ¿es **personal (Gmail)** o un **Workspace de la empresa**? ¿Quién es el propietario? | Define si los tokens caducan, si el respaldo es viable y el riesgo por pérdida de acceso |
| S2 | ¿Aceptan registrar un método de pago en Cloudflare (no se cobra dentro del nivel gratuito) para usar R2 cuando 1 GB no alcance? | Es la vía gratuita más práctica para producción |
| S3 | Volumen esperado: casos nuevos por mes y documentos por caso | Permite calcular cuándo se llena cada almacén |
