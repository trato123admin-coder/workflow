# Documento maestro de construcción
## Sistema de Gestión de Casos Sucesorios y Trámites Documentarios

**Versión:** 2.2 · **Fecha:** 23 de septiembre de 2026
**Stack:** Supabase (PostgreSQL, Auth, Storage, Realtime) · Vercel (Next.js) · Render (engine Docker) · construido con Google Antigravity
**Modo de plataforma inicial:** plan gratuito (`platform.tier = FREE`, `platform.jobs_mode = TICK`)

> **Este es el punto de entrada.** Lee este documento primero. Contiene el dominio del negocio, los datos semilla, el plan de ejecución con prompts por fase y el `AGENTS.md` consolidado. Los detalles técnicos están en los otros tres documentos del paquete.

---

## 0. Paquete de documentos y precedencia

Copiar los archivos a `/docs` del repositorio con estos nombres (la imagen de diseño va en `docs/design/`):

| Archivo original | Ruta en el repo | Contenido |
|---|---|---|
| `00_LEEME_PRIMERO_maestro_construccion_antigravity.md` (este) | `docs/00-maestro.md` | Dominio sucesorio, semillas, prompts por fase, `AGENTS.md` |
| `02_PLAN_SPRINTS_antigravity.md` | `docs/02-plan-sprints.md` | **Plan de ejecución por sprints** (orden, ítems, criterios, demos y prompts) |
| `01_ANEXO_diseno_visual_DocuAI_y_almacenamiento.md` | `docs/01-anexo-diseno-almacenamiento.md` | Diseño visual (DocuAI), navegación, componentes, responsive; arquitectura de almacenamiento de archivos y respaldo |
| `docuai-mockups.png` | `docs/design/docuai-mockups.png` | Imagen de referencia de las 9 pantallas |
| `proyecto_final_v2.1_anexo_configuracion_y_plan_gratuito.md` | `docs/v2.1.md` | Settings, catálogos, toggles, roles por permisos, APIINTI, plan gratuito |
| `proyecto_final_v2_especificacion_antigravity.md` | `docs/v2.md` | Arquitectura, modelo de datos, RLS, motor de reglas, IA, motor documental, jobs, pruebas |
| `proyecto_final_sistema_gestion_casos_documentos.md` | `docs/v1.md` | Especificación funcional base (pantallas, dashboards, campos) |

**Precedencia si hay conflicto:** `00-maestro` > `01-anexo-diseno-almacenamiento` > `v2.1` > `v2.0` > `v1`.

**Qué leer según la tarea**

| Tarea | Leer |
|---|---|
| Esquema de base de datos, RLS | `v2` §4–§5, `v2.1` §3, este documento §3 |
| Settings, catálogos, toggles, roles | `v2.1` §1–§3 |
| Motor de reglas | `v2` §6, este documento §4.4 |
| Generación Word/PDF | `v2` §8 |
| Consulta DNI/RUC | `v2.1` §4 y `docs/integrations/apiinti.md` |
| Trabajos y alertas | `v2` §10, `v2.1` §5 |
| Pantallas y dashboards | `docs/design/docuai-mockups.png`, `01-anexo` Parte A, este documento §5, `v1` §25–§43 |
| Almacenamiento y respaldo de archivos | `01-anexo` Parte B |

---

## 1. Negocio y alcance

### 1.1 Qué hace la empresa

Gestión integral de **trámites sucesorios y documentarios**. El producto que se vende es **la gestión completa del caso**, no solo una consulta legal. La empresa levanta la información, ordena la documentación, coordina con **abogados, notarías y SUNARP**, y da seguimiento hasta el cierre.

Ejemplo central: ante el fallecimiento de una persona, el equipo identifica al causante, reúne partidas (defunción, nacimiento, matrimonio), identifica posibles herederos, inventaría bienes y deudas, determina con el abogado la vía del trámite, prepara la solicitud, coordina la presentación y publicación en notaría, y gestiona la inscripción en SUNARP y, después, la de los bienes.

### 1.2 Cómo encaja en la arquitectura

```text
Fallecimiento → Caso sucesorio → Personas (causante, herederos, representantes)
              → Documentos (por caso, por persona y por bien)
              → Patrimonio (activos y pasivos)
              → Trámites externos (abogado, notaría, SUNARP)
              → Cierre / trámites posteriores (transferencia de bienes)
```

Cada sucesión es un **`Case`**; el **`CaseModel`** define sus procesos, documentos y reglas. La arquitectura de v1/v2 se mantiene; este documento añade las entidades propias del dominio.

### 1.3 Principios del dominio (no negociables)

1. **El sistema registra y organiza; no decide derechos.** Quiénes son herederos, en qué proporción y por qué vía se tramita (notarial o judicial) lo determinan **abogados y notarios**. El sistema guarda esa determinación, advierte inconsistencias y sugiere qué documentos faltan.
2. **La IA nunca determina herederos, cuotas hereditarias ni la vía procesal.** Solo puede sugerir documentos, detectar datos faltantes o incoherentes y resumir el expediente para revisión del abogado.
3. **Los requisitos, pasos y plazos de este documento son un borrador de referencia** (basado en la Ley 26662 y guías públicas). **Deben validarlos los abogados de la empresa** antes de usarlos. Por eso viven como datos editables (modelos, reglas, parámetros), no como código.
4. **Datos muy sensibles** (fallecidos, herederos, menores, patrimonio): mínimo privilegio, casos confidenciales y auditoría de accesos.

### 1.4 Fuera del alcance inicial (futuro)

Honorarios, facturación electrónica y cobranzas · portal del cliente/herederos · árbol genealógico gráfico · cálculo automático de cuotas hereditarias · integración directa con SID-SUNARP o sistemas de notarías · firma digital · renuncia de herencia como flujo propio (se modela primero como documento y trámite externo).

*El nombre comercial de la empresa se configura en Settings (`general.company_name`); no hace falta conocer la razón social exacta para construir.*

---

## 2. Decisiones y supuestos vigentes

| # | Decisión / supuesto | Estado |
|---|---|---|
| D1 | Una sola empresa (*single-tenant*) | Resuelta |
| D2 | CONSULT ve solo casos donde figura como asignado (tipo VIEWER) | Supuesto |
| D3 | IA con datos de casos | **Pendiente**. `module.ai = OFF` |
| D4 | Consulta DNI/RUC con **APIINTI** vía adaptador en el engine | Resuelta (falta `docs/integrations/apiinti.md`) |
| D5 | Supabase, Vercel y Render en plan gratuito; modo `TICK` | Resuelta (ver `v2.1` §5) |
| D6 | Giro: **gestión de trámites sucesorios y documentarios** | Resuelta |
| D7 | Plantillas DOCX: se inicia con plantillas mínimas de ejemplo; las reales las aportan los abogados | Pendiente |
| S1 | Roles iniciales: `ADMIN`, `ANALYST` (etiqueta "Gestor"), `LAWYER` (etiqueta "Abogado", nuevo), `CONSULT`, `CASHIER` (etiqueta "Caja Chica") | Supuesto |
| S2 | Abogados y notarías **externos** pueden tener usuario, con acceso solo a los casos que se les asignen | Supuesto |
| S3 | Moneda `PEN`, zona `America/Lima`, idioma `es-PE` | Resuelta |
| S4 | Los datos personales de fallecidos también se protegen (se aplica el mismo cuidado que a herederos) | Supuesto |

---

## 3. Ajustes de dominio al modelo de datos

### 3.1 Resumen de cambios respecto a v1/v2/v2.1

| Cambio | Motivo |
|---|---|
| `clients` → **`persons`** (personas naturales y jurídicas con cualquier rol) | Un mismo individuo puede ser contratante, causante o heredero en distintos casos |
| Nueva **`case_parties`** (causante, herederos, representantes, curador) | Un caso sucesorio tiene varios intervinientes con relación de parentesco y estado |
| Nuevas **`case_assets`** y **`case_liabilities`** | Inventario de bienes y deudas del causante |
| Nuevas **`external_entities`** y **`case_filings`** | Notarías, estudios, SUNARP, bancos y sus trámites (n° de expediente/título, plazos) |
| **Documentos esperados por persona y por bien** | Cada heredero exige sus partidas; cada inmueble, su copia literal |
| **Vigencia de documentos** (`issue_date`, `valid_until`) | Certificados y copias literales caducan; hay que alertar |
| `cases.parent_case_id` | Casos hijos (p. ej. transferencia de un bien tras la sucesión) |
| **Días útiles y feriados** | Plazos notariales y registrales se cuentan en días útiles |
| Rol **`LAWYER`** | El abogado revisa y aprueba documentos legales |

`persons` **reemplaza** a la tabla `clients` de v1/v2/v2.1 (renombrarla y ampliarla; el proyecto aún no está construido). `cases.client_id` pasa a `cases.client_person_id` y representa al **contratante** del servicio. Los hechos del motor de reglas `client.*` siguen refiriéndose al contratante.

### 3.2 SQL de las entidades nuevas

Las columnas de tipo catálogo usan el patrón de clave foránea compuesta de `v2.1` §3.1 (`<col>_cat` generada + FK a `catalog_items`). Los catálogos se listan en la sección 4.3.

```sql
-- PERSONAS (reemplaza a clients)
create table persons (
  id                        uuid primary key default gen_random_uuid(),
  person_type               text not null,              -- catálogo person_types
  identity_document_type    text,                       -- catálogo identity_document_types
  identity_document_number  text,
  first_name                text,
  last_name                 text,                       -- apellido paterno
  second_last_name          text,                       -- apellido materno
  legal_name                text,
  trade_name                text,
  birth_date                date,
  marital_status            text,                       -- catálogo marital_statuses
  nationality               text,                       -- catálogo countries
  email                     text,
  phone                     text,
  address                   text,
  country                   text,
  is_deceased               boolean not null default false,
  death_date                date,
  death_place               text,
  death_certificate_number  text,
  custom_data               jsonb not null default '{}',
  external_data             jsonb,
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (identity_document_type, identity_document_number),
  check (death_date is null or birth_date is null or death_date >= birth_date)
);

-- INTERVINIENTES DEL CASO
create table case_parties (
  id                        uuid primary key default gen_random_uuid(),
  case_id                   uuid not null references cases(id) on delete cascade,
  person_id                 uuid not null references persons(id),
  party_role                text not null,              -- catálogo party_roles
  relationship_to_deceased  text,                       -- catálogo relationship_types
  heir_status               text,                       -- catálogo heir_statuses (solo HEREDERO)
  share_percent             numeric(7,4) check (share_percent between 0 and 100),
  represented_by            uuid references persons(id),-- para menores o incapaces
  notes                     text,
  custom_data               jsonb not null default '{}',
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (case_id, person_id, party_role)
);
create unique index one_causante_per_case on case_parties (case_id)
  where party_role = 'CAUSANTE' and is_active;

-- PATRIMONIO: BIENES
create table case_assets (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references cases(id) on delete cascade,
  asset_type        text not null,                      -- catálogo asset_types
  description       text not null,
  registry_office   text,
  registry_ref      text,      -- partida electrónica, placa, etc. En cuentas bancarias: SOLO últimos 4 dígitos
  ownership_percent numeric(7,4) not null default 100 check (ownership_percent between 0 and 100),
  estimated_value   numeric(14,2),
  currency          text not null default 'PEN',        -- catálogo currencies
  status            text not null,                      -- catálogo asset_statuses
  custom_data       jsonb not null default '{}',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- PATRIMONIO: DEUDAS
create table case_liabilities (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references cases(id) on delete cascade,
  liability_type      text not null,                    -- catálogo liability_types
  creditor_name       text not null,
  creditor_person_id  uuid references persons(id),
  amount              numeric(14,2),
  currency            text not null default 'PEN',
  status              text not null,                    -- catálogo liability_statuses
  due_date            date,
  notes               text,
  custom_data         jsonb not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ENTIDADES EXTERNAS (notarías, estudios, SUNARP, bancos...)
create table external_entities (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,                           -- catálogo external_entity_types
  name         text not null,
  tax_id       text,
  address      text,
  city         text,
  phone        text,
  email        text,
  contacts     jsonb not null default '[]',             -- [{name, role, phone, email}]
  custom_data  jsonb not null default '{}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- TRÁMITES EXTERNOS DEL CASO
create table case_filings (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references cases(id) on delete cascade,
  case_process_id    uuid references case_processes(id),
  entity_id          uuid references external_entities(id),
  filing_kind        text not null,                     -- catálogo filing_kinds
  reference_number   text,                              -- n° de expediente, título, kardex
  filed_at           date,
  status             text not null,                     -- catálogo filing_statuses (con categoría)
  response_due_date  date,                              -- plazo para subsanar o responder
  completed_at       date,
  responsible_user   uuid references profiles(id),
  notes              text,
  custom_data        jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- FERIADOS (para plazos en días útiles)
create table holidays (
  holiday_date date primary key,
  name         text not null,
  is_active    boolean not null default true
);
```

**Cambios a tablas existentes**

```sql
alter table cases
  add column client_person_id uuid not null references persons(id),   -- reemplaza client_id
  add column parent_case_id   uuid references cases(id),
  add column route            text not null default 'POR_DEFINIR',    -- catálogo case_routes
  add column has_dispute      boolean not null default false,         -- controversia entre posibles herederos
  add column ai_allowed       boolean not null default true;

alter table case_model_documents
  add column applies_to text not null default 'CASE'
        check (applies_to in ('CASE','PARTY','ASSET')),
  add column party_role text,       -- si applies_to = 'PARTY' (p. ej. HEREDERO)
  add column asset_type text;       -- si applies_to = 'ASSET' (p. ej. INMUEBLE)

alter table case_documents
  add column person_id  uuid references persons(id),
  add column asset_id   uuid references case_assets(id),
  add column issue_date date,
  add column valid_until date;

alter table document_types add column validity_days int;  -- vigencia sugerida; NULL = no caduca
```

**Sincronización de documentos esperados.** Una función idempotente `sync_case_document_slots(case_id)` crea o desactiva los `case_documents` esperados cuando se crea el caso o se agrega/quita un interviniente o un bien:

- `applies_to = 'CASE'` → un documento por caso.
- `applies_to = 'PARTY'` → uno por cada `case_parties` activo con ese `party_role`.
- `applies_to = 'ASSET'` → uno por cada `case_assets` activo de ese `asset_type`.

Nunca borra documentos ya cargados: si un interviniente se retira, sus documentos se marcan inactivos.

**Días útiles.** Función `add_business_days(from_date, n)` que excluye sábados, domingos y los feriados de `holidays`. Los plazos (p. ej. espera de publicación) son **parámetros de Settings**, no constantes.

### 3.3 Seguridad (RLS) de las entidades nuevas

- Las tablas hijas de `cases` (`case_parties`, `case_assets`, `case_liabilities`, `case_filings`) reutilizan `private.can_access_case(case_id)` **y** el permiso y flag correspondientes.
- `persons` es transversal (una persona puede figurar en varios casos). Se lee solo si el usuario tiene `cases.read.all` o si la persona figura como contratante o interviniente en **algún caso al que tiene acceso**. Índices en `cases(client_person_id)` y `case_parties(person_id, case_id)`.
- `external_entities` es catálogo operativo: lectura con `entities.read`, edición con `entities.manage`.
- Casos `is_confidential`: sus personas y bienes solo son visibles para asignados y `ADMIN`.

**Permisos nuevos** (se suman al catálogo de `v2.1` §3.8): `parties.read`, `parties.write`, `estate.read`, `estate.write`, `filings.read`, `filings.write`, `entities.read`, `entities.manage`.

**Flags nuevos**: `module.case_parties` (ON, núcleo del dominio), `module.estate_inventory` (ON), `module.external_filings` (ON).

**Roles y permisos por defecto**

| Rol (código · etiqueta) | Permisos principales |
|---|---|
| `ADMIN` · Administrador | Superusuario |
| `ANALYST` · Gestor | `cases.read.assigned`, `cases.create`, `cases.write.assigned`, `processes.update`, `documents.*` (sin `approve`), `parties.*`, `estate.*`, `filings.*`, `entities.read`, `quotes.*`, `cash.request`, `ai.use`, `reports.read` |
| `LAWYER` · Abogado | `cases.read.assigned`, `cases.write.assigned`, `documents.read`, `documents.upload`, `documents.generate`, `documents.approve`, `parties.read`, `parties.write`, `estate.read`, `filings.read`, `filings.write`, `entities.read` |
| `CONSULT` · Consulta | `cases.read.assigned` (solo VIEWER), `documents.read`, `parties.read`, `estate.read`, `filings.read` |
| `CASHIER` · Caja Chica | `cash.read`, `cash.write`, `cash.request`, `cash.close`, `reports.read` (solo caja) |

*Todo editable desde Settings salvo `ADMIN`.*

### 3.4 Alertas propias del dominio

| Alerta | Origen |
|---|---|
| Trámite por vencer / vencido | `case_filings.response_due_date` (T-3, T-1, día D, vencido) |
| Documento por caducar o caducado | `case_documents.valid_until` |
| Cuotas de herederos confirmados ≠ 100 % | Validación de `case_parties.share_percent` (advertencia, no bloqueo) |
| Heredero sin partida de nacimiento / menor sin representante | Checklist por persona |
| Controversia declarada (`has_dispute`) | Notifica al abogado asignado |
| Caso sin abogado asignado al llegar al proceso de evaluación legal | Regla de asignación |

### 3.5 Validaciones (semáforos, no bloquean salvo indicación)

Fecha de defunción anterior a la de nacimiento (**bloquea**) · más de un `CAUSANTE` activo (**bloquea**) · documento de identidad duplicado (**bloquea**, ofrece abrir la persona existente) · suma de cuotas ≠ 100 % · heredero menor sin `represented_by` · caso con ruta `POR_DEFINIR` pasado el proceso de evaluación legal · documentos caducados.

---

## 4. Modelos de caso, documentos, reglas y catálogos semilla

**Todo lo de esta sección es un borrador editable desde Settings** y debe validarlo el equipo legal (principio 1.3.3). Se carga con `supabase/seed.sql`.

### 4.1 Modelos de caso

| Código | Nombre | Notas |
|---|---|---|
| `SUCESION_INTESTADA_NOTARIAL` | Sucesión intestada — vía notarial | Modelo principal, detallado abajo |
| `SUCESION_INTESTADA_JUDICIAL` | Sucesión intestada — vía judicial | Mismos primeros procesos; luego solicitud judicial, seguimiento de audiencias y resolución |
| `SUCESION_TESTADA` | Sucesión testada | Agrega verificación del testamento; sin búsqueda de sucesión previa como eje |
| `TRANSFERENCIA_BIEN_HEREDADO` | Transferencia de bien heredado | Caso hijo (`parent_case_id`): verificar sucesión inscrita → documentos del bien → partición/adjudicación si corresponde → presentación en el registro del bien (predios, vehicular, personas jurídicas) → observaciones → cierre |
| `TRAMITE_DOCUMENTARIO` | Trámite documentario genérico | Recepción → recolección → gestión → entrega → cierre. Puede ser recurrente |

### 4.2 Modelo principal: `SUCESION_INTESTADA_NOTARIAL`

Flujo de referencia: solicitud notarial → anotación preventiva y publicación del extracto → espera del plazo → declaración de herederos por el notario (acta) → protocolización → inscripción en el Registro de Sucesiones Intestadas de SUNARP → luego, inscripción de cada bien.

| # | Código | Proceso | Peso | Depende de | Documentos clave (★ obligatorio) |
|---|---|---|---:|---|---|
| 1 | `APERTURA` | Apertura y contrato de servicio | 5 | — | `CONTRATO_SERVICIOS` ★ |
| 2 | `DOC_CAUSANTE` | Documentos del causante | 15 | 1 | `ACTA_DEFUNCION` ★, `PARTIDA_NACIMIENTO` (causante) ★, `DNI_COPIA` (causante) ★, `PARTIDA_MATRIMONIO` (si aplica) |
| 3 | `HEREDEROS` | Identificación de herederos | 10 | 2 | Por heredero: `PARTIDA_NACIMIENTO` ★, `DNI_COPIA` ★, `PARTIDA_MATRIMONIO` (cónyuge) |
| 4 | `INVENTARIO` | Inventario de bienes y deudas | 10 | 1 | Por inmueble: `COPIA_LITERAL_DOMINIO`; por vehículo: `TARJETA_PROPIEDAD`; por cuenta: `CONSTANCIA_BANCARIA` |
| 5 | `BUSQUEDA_REGISTRAL` | Búsqueda de testamento y de sucesión previa | 5 | 1 | `CERT_BUSQUEDA_TESTAMENTO` ★, `CERT_BUSQUEDA_SUCESION` ★ |
| 6 | `EVAL_LEGAL` | Evaluación legal y definición de la vía | 10 | 3, 5 | `INFORME_LEGAL` ★ (abogado). Define `route` y `has_dispute` |
| 7 | `SOLICITUD` | Solicitud y documentos notariales | 10 | 6 | `SOLICITUD_SUCESION_INTESTADA` ★, `PODER_REPRESENTACION` (si aplica), `CARTA_NOTARIA` |
| 8 | `PRESENTACION` | Presentación en notaría, anotación preventiva y publicación | 10 | 7 | `CARGO_PRESENTACION` ★, `EDICTO_PUBLICACION` ★, `EJEMPLAR_PUBLICACION` ★ |
| 9 | `SEGUIMIENTO_NOTARIAL` | Seguimiento notarial y acta de sucesión | 10 | 8 | `ACTA_SUCESION_INTESTADA` ★, `PARTE_NOTARIAL` ★ |
| 10 | `SUNARP` | Inscripción en SUNARP | 10 | 9 | `HOJA_PRESENTACION_TITULO` ★, `ESQUELA_OBSERVACION` (si hubo), `CERT_INSCRIPCION` ★ |
| 11 | `CIERRE` | Cierre y entrega de expediente | 5 | 10 | `ACTA_ENTREGA` ★ |

*Los pesos suman 100. Los procesos 3, 4 y 5 pueden avanzar en paralelo. `sla_days` de cada proceso: definir con el equipo (sin valor por defecto).*

Parámetro editable: `filings.publication_wait_business_days` (valor inicial **15**, según guías públicas; **validar con notaría/abogado**). El plazo calculado con `add_business_days` alimenta `case_filings.response_due_date`.

### 4.3 Tipos de documento semilla

`nature`: **G**enerado (plantilla DOCX) · **U**ploaded (lo sube el equipo) · **E**xterno (lo emite notaría/registro y se sube).
`Ámbito`: `CASO`, `PERSONA:<rol>` o `BIEN:<tipo>`.

| Código | Nombre | Nat. | Ámbito |
|---|---|---|---|
| `CONTRATO_SERVICIOS` | Contrato de servicios de gestión | G | CASO |
| `CARTA_SOLICITUD_DOCUMENTOS` | Carta de solicitud de documentos al cliente | G | CASO |
| `INFORME_EXPEDIENTE_ABOGADO` | Informe del expediente para el abogado | G | CASO |
| `INFORME_LEGAL` | Informe legal | G | CASO |
| `SOLICITUD_SUCESION_INTESTADA` | Solicitud de sucesión intestada | G | CASO |
| `CARTA_NOTARIA` | Carta a la notaría | G | CASO |
| `PODER_REPRESENTACION` | Poder de representación | G | PERSONA:HEREDERO |
| `EDICTO_PUBLICACION` | Extracto/edicto para publicación (borrador) | G | CASO |
| `ACTA_ENTREGA` | Acta de entrega de expediente | G | CASO |
| `DNI_COPIA` | Copia de documento de identidad | U | PERSONA:CAUSANTE / HEREDERO |
| `ACTA_DEFUNCION` | Acta/partida de defunción | U | CASO |
| `PARTIDA_NACIMIENTO` | Partida de nacimiento | U | PERSONA:CAUSANTE / HEREDERO |
| `PARTIDA_MATRIMONIO` | Partida de matrimonio | U | CASO / PERSONA:HEREDERO |
| `CERT_BUSQUEDA_TESTAMENTO` | Certificado de búsqueda de testamento | U | CASO |
| `CERT_BUSQUEDA_SUCESION` | Certificado de búsqueda de sucesión intestada | U | CASO |
| `TESTAMENTO_COPIA` | Copia del testamento | U | CASO |
| `COPIA_LITERAL_DOMINIO` | Copia literal de dominio | U | BIEN:INMUEBLE |
| `TARJETA_PROPIEDAD` | Tarjeta de propiedad vehicular | U | BIEN:VEHICULO |
| `CONSTANCIA_BANCARIA` | Constancia o estado de cuenta | U | BIEN:CUENTA_BANCARIA |
| `CARGO_PRESENTACION` | Cargo de presentación en notaría | U | CASO |
| `EJEMPLAR_PUBLICACION` | Ejemplar de la publicación | U | CASO |
| `HOJA_PRESENTACION_TITULO` | Hoja de presentación del título | U | CASO |
| `ESQUELA_OBSERVACION` | Esquela de observación | U | CASO |
| `ACTA_SUCESION_INTESTADA` | Acta notarial de sucesión intestada | E | CASO |
| `PARTE_NOTARIAL` | Parte notarial | E | CASO |
| `ESCRITURA_PUBLICA` | Escritura pública | E | CASO |
| `CERT_INSCRIPCION` | Certificado/constancia de inscripción | E | CASO |

`validity_days` de certificados y copias literales: **a definir con el equipo** (dejar `NULL` hasta confirmarlo).

### 4.4 Reglas documentales semilla (DSL de `v2` §6)

Hechos nuevos del motor de reglas, además de los de `v2` §6: `parties.causante.marital_status`, `parties.heirs_count`, `parties.has_minor_heir`, `parties.has_foreign_resident`, `case.has_dispute`, `case.route`, `assets.types` (lista), `assets.count`, `assets.total_estimated_value`, `docs.types`, `case.custom_data.<clave>`.

| Regla | Condiciones | Efecto |
|---|---|---|
| Partida de matrimonio del causante | Modelo = `SUCESION_INTESTADA_NOTARIAL` **y** `parties.causante.marital_status` ∈ {`CASADO`, `VIUDO`} | `REQUIRE` `PARTIDA_MATRIMONIO` (ámbito CASO) |
| Heredero menor de edad | `parties.has_minor_heir` = true | `RECOMMEND` `INFORME_LEGAL` (prioridad 1) y alerta "verificar representación del menor" |
| Controversia entre herederos | `case.has_dispute` = true | `EXCLUDE` `SOLICITUD_SUCESION_INTESTADA`; `RECOMMEND` `INFORME_LEGAL` |
| Heredero residente en el extranjero | `parties.has_foreign_resident` = true | `RECOMMEND` `PODER_REPRESENTACION` |
| Hay inmuebles en el patrimonio | `assets.types` contiene `INMUEBLE` | `REQUIRE` `COPIA_LITERAL_DOMINIO` (ámbito BIEN) |
| Ruta judicial definida | `case.route` = `JUDICIAL` | `EXCLUDE` documentos notariales de los procesos 7–9 |
| Derivación al abogado | Proceso = `EVAL_LEGAL` y no hay abogado asignado | `RECOMMEND` `INFORME_EXPEDIENTE_ABOGADO` |

Ejemplo en el DSL:

```json
{
  "version": 1,
  "conditions": {
    "all": [
      { "fact": "case_model.code", "op": "eq", "value": "SUCESION_INTESTADA_NOTARIAL" },
      { "fact": "parties.causante.marital_status", "op": "in", "value": ["CASADO", "VIUDO"] }
    ]
  },
  "effect": { "type": "REQUIRE", "priority": 1 },
  "explanation": "Si el causante estuvo casado, se requiere partida de matrimonio para acreditar al cónyuge"
}
```

### 4.5 Catálogos semilla del dominio (además de los de `v2.1` §3.2)

| Catálogo | Elementos iniciales |
|---|---|
| `person_types` | `NATURAL`, `JURIDICA` |
| `identity_document_types` | `DNI`, `CE`, `RUC` (activos); `PASAPORTE`, `OTRO` (inactivos) |
| `marital_statuses` | `SOLTERO`, `CASADO`, `VIUDO`, `DIVORCIADO`, `CONVIVIENTE` |
| `party_roles` | `CAUSANTE`, `HEREDERO`, `REPRESENTANTE`, `CURADOR`, `OTRO` |
| `relationship_types` | `CONYUGE`, `CONVIVIENTE`, `HIJO`, `PADRE`, `MADRE`, `HERMANO`, `NIETO`, `OTRO` |
| `heir_statuses` | `PRESUNTO`, `CONFIRMADO`, `EXCLUIDO`, `RENUNCIANTE` |
| `asset_types` | `INMUEBLE`, `VEHICULO`, `CUENTA_BANCARIA`, `PARTICIPACION_EMPRESARIAL`, `MUEBLE`, `OTRO` |
| `asset_statuses` | `IDENTIFICADO`, `VERIFICADO`, `TRANSFERIDO`, `EN_LITIGIO` |
| `liability_types` | `TRIBUTARIA`, `BANCARIA`, `PERSONAL`, `OTRA` |
| `liability_statuses` | `IDENTIFICADA`, `VERIFICADA`, `PAGADA`, `DISPUTADA` |
| `external_entity_types` | `NOTARIA`, `ESTUDIO_ABOGADOS`, `SUNARP`, `BANCO`, `SUNAT`, `MUNICIPALIDAD`, `OTRA` |
| `filing_kinds` | `SOLICITUD_NOTARIAL`, `ANOTACION_PREVENTIVA`, `PUBLICACION_EDICTO`, `TITULO_SUNARP`, `ESCRITURA_PUBLICA`, `DERIVACION_ABOGADO`, `OTRO` |
| `filing_statuses` | `PENDIENTE` (cat. `PENDING`), `PRESENTADO` (`SUBMITTED`), `OBSERVADO` (`OBSERVED`), `INSCRITO`/`CONCLUIDO` (`DONE`), `RECHAZADO` (`REJECTED`) |
| `case_routes` | `POR_DEFINIR`, `NOTARIAL`, `JUDICIAL` |

Estados de workflow: los 8 de v1 §10, cada uno con su categoría semántica (`v2.1` §3.2). Los relacionados con **derecho de convivientes** o cualquier otra figura sucesoria se agregan o ajustan **solo por indicación del equipo legal**.

---

## 5. Pantallas nuevas o ajustadas

| Área | Cambio |
|---|---|
| **Asistente "Nuevo caso"** | 1) Contratante (buscar o crear persona, con consulta DNI/RUC) → 2) Causante → 3) Modelo de caso → 4) Herederos (opcional, se pueden agregar después) → 5) Asignación de gestor y abogado |
| **Detalle del caso — pestañas** | Resumen · **Personas** (causante, herederos, representantes; checklist por persona) · **Patrimonio** (bienes y deudas con totales por moneda) · Procesos · Documentos (agrupados por caso, persona y bien) · **Trámites externos** (notaría, SUNARP; n° de expediente/título y plazos) · Recomendaciones IA · Cotizaciones y gastos · Actividad · Auditoría |
| **Personas** | Buscador global por DNI, RUC o nombre; ficha con los casos en que participa |
| **Entidades externas** | Directorio de notarías, estudios de abogados, oficinas SUNARP y bancos con contactos |
| **Dashboard Administrador** | Embudo de casos por proceso · trámites con plazo por vencer · casos sin abogado · documentos caducados · carga por gestor |
| **Dashboard Gestor** | Bandeja "qué hago hoy": documentos faltantes por persona, trámites observados, publicaciones en plazo |
| **Dashboard Abogado** | Casos pendientes de evaluación legal, documentos por aprobar, casos con controversia |
| **Caja chica** | Gastos por caso (tasas notariales, publicaciones, derechos registrales) mediante `cash_movements.case_id` |

---

## 6. IA en el dominio sucesorio

`module.ai` nace **apagado** (D3). Cuando se active, se aplican `v2` §7 y estas restricciones específicas:

**Puede**
- Recomendar qué documento corresponde en cada proceso, entre los candidatos que permiten las reglas.
- Detectar **documentos faltantes por persona o por bien** ("el heredero X no tiene partida de nacimiento").
- Detectar **incoherencias** de datos (fechas, apellidos, duplicados, cuotas que no suman 100 %).
- Resumir el expediente para el abogado (`INFORME_EXPEDIENTE_ABOGADO`) y prellenar campos narrativos, **siempre para revisión humana**.

**No puede, bajo ninguna circunstancia**
- Determinar quiénes son herederos, sus cuotas o su orden sucesorio.
- Decidir la vía procesal (notarial o judicial) ni concluir que existe o no controversia.
- Modificar personas, bienes, cuotas, estados de trámite o plazos.
- Recibir datos sin enmascarar (documentos de identidad, direcciones, cuentas) ni datos de menores de edad. Los casos con `ai_allowed = false` o `is_confidential = true` quedan excluidos.

Todo texto generado por IA se rotula como **"Sugerencia para revisión legal"** y no puede marcarse como definitivo sin aprobación de un usuario con `documents.approve`.

---

## 7. Datos sensibles y cumplimiento

- El sistema trata datos de **fallecidos, herederos, menores de edad y patrimonio**. Se aplican mínimo privilegio, casos confidenciales, auditoría de lecturas y descargas, y enmascarado de documentos de identidad en listados (`clients.mask_visible_last`).
- **Cuentas bancarias:** solo se guardan los últimos 4 dígitos. Nunca números completos.
- **Menores de edad:** su información no sale del sistema hacia servicios externos (IA, Telegram, correo).
- Los tratamientos de datos personales deben alinearse con la **Ley 29733** y su reglamento; conviene contar con cláusulas en el contrato de servicios y una política de retención por definir con asesoría legal (`v2` §7.6).
- **Telegram:** mensajes mínimos (n.º de caso, tipo de alerta, enlace). Nunca nombres, montos ni contenido de documentos.
- **El sistema no presta asesoría legal.** Las plantillas, requisitos, plazos y rutas deben ser validados por los abogados de la empresa antes de operar con clientes reales.

---

## 8. Plan de ejecución con Antigravity

### 8.1 Antes de empezar (lista de arranque)

- [ ] Repositorio **privado** en GitHub.
- [ ] Dos proyectos de Supabase (staging y producción), región lo más cercana posible a Lima. **No pegar sus claves en el chat ni en prompts**: van en variables de entorno.
- [ ] Proyecto de Vercel conectado al repo (`apps/web`). Servicio Web de Render con Docker (`services/engine`), plan gratuito.
- [ ] Instalados: Docker, Node 22, pnpm, Supabase CLI, Antigravity.
- [ ] Los documentos y la imagen de diseño copiados a `/docs` (sección 0) y `AGENTS.md` (sección 9) en la raíz.
- [ ] **Regenerada** la API key de APIINTI y su documentación guardada en `docs/integrations/apiinti.md`.
- [ ] Lista de las 5–10 plantillas DOCX más usadas y de los requisitos vigentes, validada por los abogados.

### 8.2 Forma de trabajar

1. **Una fase por conversación/agente y por rama** (`feat/fase-N-tema`). No pedir todo el sistema de una vez.
2. Empezar siempre en modo de **planificación**: el agente presenta el plan y **tú lo apruebas** antes de que escriba código, sobre todo en cambios de esquema, seguridad o caja.
3. **Revisa cada migración SQL y cada política RLS tú mismo** (o con el abogado técnico del equipo) antes de aplicarlas en staging.
4. Si usas varios agentes en paralelo, asígnales carpetas distintas (`supabase/` · `apps/web/` · `services/engine/`) y define los contratos en `packages/shared` primero.
5. Cierra cada fase con el checklist de aceptación marcado y los comandos para verificarlo.

> **Ejecución por sprints:** el plan detallado, con ítems numerados, criterios de aceptación, guiones de demo y un prompt por sprint, está en `docs/02-plan-sprints.md` y **es el que se usa para construir**. La tabla por fases de abajo se conserva como resumen; en el plan de sprints la Caja chica va antes de la IA.

### 8.3 Fases y prompts listos

Cada prompt se pega tal cual en Antigravity (ajusta solo lo que aparece entre `< >`).

| Fase | Contenido (con el dominio incorporado) |
|---|---|
| **0** Fundaciones | Monorepo, CI, Supabase local, migración base, esqueletos web y engine |
| **1A** Identidad, seguridad y sistema de diseño | Auth, MFA, perfiles, roles y permisos, RLS por permisos, usuarios; tokens y componentes base (`01-anexo` Parte A) |
| **1B** Settings | Catálogos, toggles, parámetros, campos personalizados, tema, exportar/importar configuración |
| **2** Personas y casos | `persons`, casos, `case_parties`, patrimonio, modelos versionados y semillas, procesos, avance, dashboards |
| **3** Documentos y trámites | Tipos, subida/versionado, **capa `StorageProvider`** (`01-anexo` Parte B), documentos por persona y bien, plantillas, entidades externas, `case_filings` |
| **4** Reglas y generación (**MVP**) | DSL + simulador, generación DOCX/PDF, aprobación por abogado |
| **5** Automatización | Cola y modo `TICK`, alertas del dominio, Telegram, APIINTI, recurrencia, **respaldo cifrado de archivos** (`01-anexo` B.6) |
| **6** Gastos y reportes | Proveedores y cotizaciones, gastos por caso, reportes y exportaciones |
| **7** IA | Recomendador reglas-primero, revisiones de faltantes (si D3 lo permite) |
| **8** Caja chica | Libro inmutable, solicitudes, arqueo y cierre |
| **9** Endurecimiento | Rendimiento, seguridad, restauración de backups, runbook |

**Fase 0 — Fundaciones**

```text
Lee AGENTS.md, docs/00-maestro.md (secciones 0, 1, 8), docs/v2.md (secciones 2, 4.1, 11, 12) y docs/v2.1.md (secciones 1 y 5).
Objetivo: Fase 0 — Fundaciones. Trabaja en la rama feat/fase-0-fundaciones.

Primero presenta un plan por pasos y espera mi aprobación. Luego implementa:
1. Monorepo pnpm: apps/web (Next.js App Router, TypeScript estricto, Tailwind, shadcn/ui, next-intl es-PE),
   services/engine (Node + Fastify + TypeScript + Dockerfile), packages/shared (zod y utilidades), supabase/.
2. Supabase local con la CLI. Migración base: extensiones (pgcrypto, pg_trgm, unaccent, vector), esquema "private",
   trigger set_updated_at, tablas audit_logs y job_queue (append-only donde corresponda), función next_case_number.
3. engine con /healthz y /readyz, validación de variables de entorno con zod, logger estructurado.
4. web con layout base vacío y una página /health.
5. CI en GitHub Actions: lint, typecheck, vitest, supabase db reset + supabase test db, escáner de secretos.
6. Prueba pgTAP que FALLE si alguna tabla de public no tiene RLS habilitada.
7. .env.example con nombres de variables y valores vacíos (sin secretos reales). README con cómo levantar todo.
No pidas ni escribas claves reales. No toques producción.
Criterio de aceptación: pnpm dev levanta todo; CI verde; la prueba de RLS falla al crear una tabla sin RLS.
Termina con el checklist marcado y los comandos para verificar.
```

**Fase 1A — Identidad y seguridad**

```text
Lee AGENTS.md, docs/v2.md (secciones 5 y 12), docs/v2.1.md (sección 3.8) y docs/00-maestro.md (sección 3.3).
Objetivo: Fase 1A. Rama feat/fase-1a-identidad. Presenta el plan y espera aprobación antes de programar.

Implementa: Supabase Auth con MFA (TOTP); tablas profiles, roles (is_system, is_superuser), permissions, user_roles, role_permissions;
catálogo de permisos completo (v2.1 §3.8 + 00-maestro §3.3) como semilla; funciones private.has_permission() y private.can_access_case();
RLS por permisos (NO por nombre de rol); trigger que impide desactivar o quitar el rol al último administrador;
roles semilla ADMIN, ANALYST (etiqueta Gestor), LAWYER (Abogado), CONSULT, CASHIER (Caja Chica) con los permisos de 00-maestro §3.3;
pantalla de login, MFA y administración de usuarios y roles (matriz de permisos editable); layout base de v1 §26 con navegación por permisos;
auditoría base (login, cambios de roles y permisos).
Pruebas pgTAP: matriz rol x tabla x operación; el último ADMIN no puede desactivarse; un rol nuevo con permisos elegidos funciona.
Criterio de aceptación: login con MFA; ADMIN crea usuarios y roles; las pruebas de RLS pasan en CI.
```

**Fase 1B — Settings**

```text
Lee AGENTS.md y docs/v2.1.md (secciones 1, 2 y 3 completas).
Objetivo: Fase 1B — módulo Settings. Rama feat/fase-1b-settings. Presenta el plan y espera aprobación.

Implementa: catalogs y catalog_items (con item_schema y validación de metadata); feature_flags con dependencias y función private.feature_enabled();
setting_definitions, system_settings y settings_history (append-only); custom_field_definitions; seeds de catálogos, flags y parámetros
(v2.1 §3.2, §3.5, §3.7 y 00-maestro §4.5); pantallas de Settings generadas a partir de las definiciones (pestañas de v2.1 §2);
editor genérico de catálogos con toggle is_active, candado en elementos is_system y etiqueta "En uso (N)";
diálogo de impacto al desactivar (v2.1 §3.6); tema con validación de contraste AA; exportar/importar configuración con diff previo.
Cada cambio de configuración queda en settings_history con usuario, valores y motivo.
Criterio de aceptación: crear un elemento de catálogo y un campo personalizado desde la UI sin desplegar código; apagar un flag oculta el módulo,
responde 403 y lo bloquea por RLS; los datos se conservan.
```

**Fase 2 — Personas y casos**

```text
Lee AGENTS.md, docs/00-maestro.md (secciones 3, 4 y 5), docs/v2.md (secciones 4 y 5) y docs/v1.md (secciones 7 a 10, 31 a 33, 48).
Objetivo: Fase 2. Rama feat/fase-2-personas-casos. Presenta el plan y espera aprobación (toca esquema y RLS).

Implementa: tablas persons, case_parties, case_assets, case_liabilities, holidays y los ALTER de 00-maestro §3.2, con RLS de §3.3;
case_model_versions (DRAFT/PUBLISHED/ARCHIVED) y modelos versionados con dependencias; carga de los 5 modelos semilla de 00-maestro §4.1–4.2
(SUCESION_INTESTADA_NOTARIAL completo; los demás como borrador) y de los catálogos de §4.5;
función sync_case_document_slots(case_id) y add_business_days(); cálculo de avance por trigger (prueba: pesos 20/30/30/20 con 100/80/40/0 = 56);
compuertas de cierre; case_events; asistente "Nuevo caso" (5 pasos), pestañas Resumen, Personas, Patrimonio y Procesos;
validaciones de 00-maestro §3.5; búsqueda global (Ctrl+K); dashboards Administrador y Gestor con datos reales.
Los formularios de persona se construyen desde los catálogos person_types e identity_document_types (validación por patrón y dígito verificador RUC).
Criterio de aceptación: crear un caso sucesorio con contratante, causante, 3 herederos (uno menor) y un inmueble genera el checklist esperado
por caso, por persona y por bien; las validaciones avisan; el avance coincide con la fórmula.
```

**Fase 3 — Documentos y trámites**

```text
Lee AGENTS.md, docs/v2.md (secciones 5.3, 8.3), docs/v1.md (secciones 11 a 14 y 34) y docs/00-maestro.md (secciones 3 y 4.3).
Objetivo: Fase 3. Rama feat/fase-3-documentos. Presenta el plan y espera aprobación.

Implementa: document_types y case_model_documents (con applies_to CASE/PARTY/ASSET); subida, versionado y descarga con URL firmada de 60 s emitida por el engine y auditada;
buckets y políticas de Storage de v2 §5.3; validación de tipo y tamaño de archivo; checklist documental por proceso, persona y bien (semáforo);
valid_until y validity_days; external_entities (directorio) y case_filings con response_due_date calculado en días útiles;
pestañas Documentos y Trámites externos; administración de plantillas DOCX, template_fields y lint de marcadores al subir.
Pruebas: un gestor solo accede a documentos de sus casos; la descarga queda auditada; el lint detecta marcadores rotos.
```

**Fase 4 — Reglas y generación (MVP)**

```text
Lee AGENTS.md, docs/v2.md (secciones 6 y 8) y docs/00-maestro.md (secciones 4.4 y 6).
Objetivo: Fase 4. Rama feat/fase-4-reglas-generacion. Presenta el plan y espera aprobación.

Implementa: motor de reglas en packages/shared (DSL de v2 §6 con los hechos nuevos de 00-maestro §4.4), esquema zod, traza y ≥ 40 pruebas;
simulador de reglas para el administrador; las 7 reglas semilla de 00-maestro §4.4;
generation_jobs asíncronos con Realtime; generación DOCX (docxtemplater o docx-templates; verifica licencias) y PDF con LibreOffice (toggle docs.pdf_generation);
vista previa con marca de agua BORRADOR; estados y aprobación (rol LAWYER con documents.approve); idempotency_key; snapshot de datos, plantilla y reglas.
Crea 3 plantillas DOCX de ejemplo (CONTRATO_SERVICIOS, SOLICITUD_SUCESION_INTESTADA, CARTA_NOTARIA) con datos ficticios, como casos dorados en CI.
Criterio de aceptación: generación completa de un documento con plantilla dorada (Word y PDF, hash, versión+1); repetir la solicitud no duplica versiones;
el sistema puede usarse en producción sin IA.
```

**Fase 5 — Automatización**

```text
Lee AGENTS.md, docs/v2.md (secciones 10 y 11), docs/v2.1.md (secciones 4 y 5), docs/integrations/apiinti.md y docs/00-maestro.md (sección 3.4).
Objetivo: Fase 5. Rama feat/fase-5-automatizacion. Presenta el plan y espera aprobación.

Implementa: cola job_queue con claim_jobs (SKIP LOCKED, backoff); modo TICK (pg_cron + pg_net llaman a POST /v1/jobs/tick con secreto en Vault) y modo CONTINUOUS por parámetro;
alertas de 00-maestro §3.4 con dedupe_key; estancamiento; Telegram (vinculación con código de un solo uso; mensajes mínimos); resumen matutino;
recurrencia de casos; adaptador IdentityLookupProvider para APIINTI con caché, cuota y auditoría (la clave solo por variable de entorno);
pantalla de monitoreo (salud y latencia); workflow de GitHub Actions con pg_dump cifrado y exportación de Storage.
Criterio de aceptación: sin alertas duplicadas; una consulta DNI/RUC completa el alta y, si falla, se puede seguir a mano; el respaldo se ejecuta y se restaura en staging.
```

**Fases 6 a 9** — usar la plantilla de `v2` §13.1 con las secciones indicadas en `v2` §13.2 (Fase 6: cotizaciones y reportes; Fase 7: IA, solo si D3 lo permite y respetando la sección 6 de este documento; Fase 8: caja chica; Fase 9: endurecimiento).

---

## 9. `AGENTS.md` consolidado (copiar a la raíz del repositorio)

Reemplaza al de `v2` §14.

````markdown
# AGENTS.md

## Proyecto
Sistema de gestión de casos sucesorios y trámites documentarios (workflow, documentos, caja chica).
Punto de entrada: docs/00-maestro.md. Precedencia: 00-maestro > 01-anexo-diseno-almacenamiento > v2.1 > v2.0 > v1.
Referencia visual: docs/design/docuai-mockups.png (estilo y estructura; los datos de muestra NO son el dominio).
Plan de ejecución: docs/02-plan-sprints.md. Un sprint por rama (feat/sprint-N-tema); implementar SOLO los ítems del sprint indicado.

## Stack
- Web: Next.js (App Router), TypeScript estricto, Tailwind, shadcn/ui, TanStack Query, react-hook-form + zod, next-intl (es-PE) -> Vercel
- Engine: Node + TypeScript (Fastify), docxtemplater o docx-templates, LibreOffice headless, Docker -> Render
- Datos: Supabase (PostgreSQL, Auth, Storage, Realtime, pg_cron, pg_net, pgvector)
- Pruebas: Vitest, Playwright, pgTAP
- Monorepo pnpm: apps/web, services/engine, packages/shared, supabase

## Reglas no negociables
- Nunca ejecutar comandos contra producción. Solo local o staging.
- Los secretos solo en variables de entorno. Nunca leer, imprimir ni commitear .env. Nunca pedir claves reales; usar .env.example.
- Todo cambio de esquema es una migración nueva en supabase/migrations. Nunca editar migraciones ya aplicadas.
- Toda tabla en public tiene RLS habilitada, políticas y prueba pgTAP.
- La RLS usa private.has_permission() y private.feature_enabled(), no nombres de rol.
- service_role jamás en apps/web ni en variables NEXT_PUBLIC_*. El navegador nunca llama a servicios externos (APIINTI, IA, Telegram).
- Prohibido escribir listas fijas de negocio en el código (tipos de documento, de persona, prioridades, estados, categorías, roles). Se leen de catálogos, workflow_statuses o settings. La lógica usa categorías semánticas y permisos, nunca etiquetas.
- Todo elemento configurable tiene is_active (toggle). Nunca DELETE de configuración en uso: solo desactivar.
- audit_logs, settings_history y cash_movements son append-only. Correcciones de caja con reversos.
- Archivos solo en Storage privado; descargas por URL firmada emitida por el engine y auditadas.
- Lógica de avance y del DSL de reglas solo en packages/shared, con pruebas unitarias.
- Código e identificadores en inglés; textos de interfaz en español (es-PE) vía i18n; moneda PEN; zona America/Lima.
- Accesibilidad AA y diseño responsive (móvil primero).
- Diseño: colores, tipografía y espaciados solo desde tokens CSS (temas por data-theme); reutilizar los componentes de docs/01-anexo Parte A. Abrir docs/design/docuai-mockups.png al construir cada pantalla.
- Archivos: todo acceso pasa por la interfaz StorageProvider del engine; nunca guardar archivos en tablas de la base de datos; cada versión registra storage_backend, storage_key y sha256. El respaldo a Drive solo va cifrado.

## Reglas del dominio
- El sistema registra y organiza; NO decide derechos. Nunca calcular ni asignar automáticamente herederos, cuotas hereditarias ni la vía procesal (notarial o judicial): eso lo determina un abogado o notario y el sistema solo guarda su decisión.
- La IA solo recomienda, con candidatos definidos por reglas, salida validada con zod y rotulada "Sugerencia para revisión legal". No recibe datos sin enmascarar ni datos de menores. Respetar ai_allowed y is_confidential.
- Cuentas bancarias: solo los últimos 4 dígitos. Nunca números completos.
- Requisitos, pasos y plazos legales son datos editables (modelos, reglas, parámetros) y borradores hasta que los valide el equipo legal. Los plazos se cuentan en días útiles con la tabla holidays.
- Documentos esperados por caso, por persona y por bien se generan con sync_case_document_slots (idempotente); nunca se borran documentos ya cargados.

## Flujo de trabajo
1. Leer las secciones de docs relevantes a la tarea.
2. Proponer un plan por ítems del sprint y esperar aprobación antes de escribir código (siempre si toca esquema, RLS, seguridad, caja, IA o envío de datos a terceros).
3. Trabajar en la rama feat/sprint-N-tema, con cambios pequeños y commits convencionales. Lo que quede fuera del alcance del sprint se anota, no se hace.
4. Ejecutar lint, typecheck, pruebas unitarias, pgTAP y e2e antes de abrir el PR.
5. El PR incluye el checklist de aceptación del sprint, el guion de demo ejecutado, decisiones tomadas y riesgos; actualizar CHANGELOG y ADR.

## Comandos
- pnpm dev | pnpm lint | pnpm typecheck | pnpm test | pnpm e2e
- supabase start | supabase db reset | supabase test db | supabase gen types typescript --local

## Calidad
- Archivos <= 300 líneas, funciones <= 30 líneas, sin console.log (usar logger estructurado).
- Validar con zod toda frontera (formularios, API, respuesta de IA, variables de entorno).

## Detenerse y preguntar cuando
- Una regla de negocio sea ambigua o contradictoria entre documentos.
- El trabajo dependa de una decisión pendiente (docs/00-maestro.md sección 2).
- El cambio afecte RLS, caja chica, auditoría, datos de menores o el envío de datos a la IA.
````

---

## 10. Criterios de aceptación del dominio

**Escenario dorado de extremo a extremo** (debe pasar como prueba E2E al terminar la Fase 4):

1. El gestor crea el **contratante** (consulta DNI/RUC, o alta manual si el servicio no responde).
2. Crea el caso `SUCESION_INTESTADA_NOTARIAL`, registra al **causante** (con fecha de defunción) y **3 herederos**, uno de ellos menor de edad y uno casado.
3. Agrega **un inmueble** y **una cuenta bancaria** (solo últimos 4 dígitos) al patrimonio.
4. El sistema genera el **checklist**: documentos del causante, partida de nacimiento y DNI por cada heredero, copia literal por el inmueble, constancia por la cuenta.
5. Se muestran advertencias: menor sin representante; cuotas confirmadas que no suman 100 %.
6. El abogado asignado completa el informe legal, define la vía (`route`) y aprueba el documento.
7. El gestor genera la **solicitud de sucesión intestada** (Word y PDF) con datos precargados; queda versionada con snapshot.
8. Registra el **trámite en notaría** con n.º de expediente; el sistema calcula el plazo en días útiles y crea la alerta.
9. Se marca `has_dispute = true`: la regla excluye la solicitud notarial y notifica al abogado.
10. El avance del caso coincide con la fórmula ponderada; el caso no puede cerrarse con documentos obligatorios pendientes.
11. Toda la operación queda en auditoría; un usuario `CONSULT` no puede modificar nada y un `CASHIER` no ve el caso.

**Criterios adicionales**

- [ ] Ningún listado de negocio está escrito en el código; todo sale de catálogos y settings.
- [ ] Una sucesión con ≥ 10 herederos y ≥ 20 bienes se opera sin degradar el rendimiento (p95 < 2 s en la ficha del caso).
- [ ] Un caso `is_confidential` es invisible para quien no está asignado.
- [ ] Ningún dato de menores ni número completo de cuenta sale del sistema hacia servicios externos.
- [ ] Criterios de `v2` §13.3 y `v2.1` §6.

---

## 11. Pendientes y validaciones

| # | Pendiente | Responsable |
|---|---|---|
| D3 | ¿Se permite enviar datos de casos (enmascarados) a un proveedor de IA? ¿Cuál? | Dirección |
| D7 | Plantillas DOCX reales y su validación | Abogados |
| L1 | Validar modelos, requisitos, documentos por vía y **plazos** (p. ej. días útiles de espera de la publicación) | Abogados |
| L2 | Definir `validity_days` de certificados y copias literales | Abogados |
| L3 | Confirmar tratamiento de convivientes y demás figuras sucesorias en catálogos y reglas | Abogados |
| L4 | Política de retención de datos y cláusulas de protección de datos en el contrato de servicios | Asesoría legal |
| S1 | Cuenta de Google para el respaldo: ¿personal o Workspace de la empresa? ¿Quién es el propietario? (`01-anexo` B.8) | Dirección |
| S2 | ¿Se acepta registrar un método de pago en Cloudflare para usar R2 cuando 1 GB no alcance? | Dirección |
| S3 | Volumen esperado: casos por mes y documentos por caso | Dirección |
| T1 | Regenerar la API key de APIINTI y guardar su documentación en `docs/integrations/apiinti.md` | Dirección / TI |
| T2 | Formato vigente del número de Carnet de Extranjería | TI |
| T3 | Decidir cuándo subir Supabase a Pro (antes de cargar datos reales) | Dirección |

---

## Estado

**Paquete listo para iniciar la Fase 0.** Orden recomendado: completar la lista de arranque (sección 8.1) → Fase 0 → 1A → 1B → 2 → 3 → 4 (MVP usable) → 5 → resto.
