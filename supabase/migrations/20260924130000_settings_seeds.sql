-- Migración: 20260924130000_settings_seeds.sql
-- Sprint 2: Semillas de catálogos, elementos de catálogo, feature flags y parámetros tipados
-- Precedencia y reglas: v2.1 §3.2, §3.5, §3.7, 00-maestro §4.5, AGENTS.md

begin;

-- ============================================================================
-- 1. CATÁLOGOS BASE Y DE DOMINIO (23 catálogos)
-- ============================================================================

insert into public.catalogs (code, name, description, module, allow_new_items, is_system) values
  ('person_types', 'Tipos de Persona', 'Clasificación jurídica de intervinientes y clientes', 'clients', false, true),
  ('identity_document_types', 'Tipos de Documento de Identidad', 'Documentos de identidad oficiales admisibles', 'clients', true, true),
  ('case_priorities', 'Prioridades de Caso', 'Niveles de prioridad y urgencia operativa', 'cases', true, true),
  ('case_statuses', 'Estados de Caso', 'Estados generales del ciclo de vida del caso', 'cases', false, true),
  ('recurrence_frequencies', 'Frecuencias de Recurrencia', 'Intervalos de periodicidad para trámites recurrentes', 'cases', true, true),
  ('case_categories', 'Categorías de Trámite', 'Líneas de servicio y modelos de tramitación', 'cases', true, true),
  ('document_categories', 'Categorías Documentales', 'Clasificación de documentos del expediente', 'documents', true, true),
  ('party_roles', 'Roles de Intervinientes', 'Posición jurídica dentro del caso sucesorio', 'cases', true, true),
  ('relationship_types', 'Tipos de Parentesco', 'Vínculos familiares con el causante', 'cases', true, true),
  ('heir_statuses', 'Estados de Heredero', 'Condición del heredero en la declaratoria', 'cases', false, true),
  ('asset_types', 'Tipos de Bienes', 'Clasificación de activos del patrimonio hereditario', 'cases', true, true),
  ('asset_statuses', 'Estados de Bienes', 'Situación registral o de verificación del activo', 'cases', true, true),
  ('liability_types', 'Tipos de Deudas', 'Obligaciones y pasivos de la masa hereditaria', 'cases', true, true),
  ('liability_statuses', 'Estados de Deudas', 'Situación de verificación y pago de pasivos', 'cases', true, true),
  ('external_entity_types', 'Tipos de Entidades Externas', 'Notarías, registros, bancos y estudios', 'entities', true, true),
  ('filing_kinds', 'Tipos de Trámite Externo', 'Presentaciones y gestiones externas', 'filings', true, true),
  ('filing_statuses', 'Estados de Trámite Externo', 'Situación de la gestión ante notaría o registro', 'filings', false, true),
  ('case_routes', 'Rutas Procesales', 'Vía de tramitación del caso sucesorio', 'cases', false, true),
  ('cash_categories', 'Categorías de Caja Chica', 'Rubros de ingresos y egresos de caja', 'cash', true, true),
  ('cash_account_types', 'Tipos de Cuenta de Caja', 'Medios y cuentas para fondos de caja', 'cash', true, true),
  ('currencies', 'Monedas Oficiales', 'Monedas admitidas en el sistema', 'finance', false, true),
  ('countries', 'Países', 'Países de origen o radicación', 'clients', true, true),
  ('marital_statuses', 'Estados Civiles', 'Estado civil de intervinientes y causante', 'clients', true, true)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      module = excluded.module;

-- ============================================================================
-- 2. ELEMENTOS DE CATÁLOGO (catalog_items)
-- ============================================================================

-- 2.1 person_types
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active, metadata) values
  ('person_types', 'NATURAL', 'Persona Natural', 1, true, true, '{"name_mode":"PERSON","requires_last_names":true,"allowed_documents":["DNI","CE","PASAPORTE"]}'::jsonb),
  ('person_types', 'JURIDICA', 'Persona Jurídica', 2, true, true, '{"name_mode":"COMPANY","requires_trade_name":false,"allowed_documents":["RUC"]}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.2 identity_document_types (DNI, CE, RUC activos; PASAPORTE, OTRO inactivos por defecto)
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active, metadata) values
  ('identity_document_types', 'DNI', 'DNI - Documento Nacional de Identidad', 1, true, true, '{"person_types":["NATURAL"],"min_length":8,"max_length":8,"pattern":"^\\d{8}$","check_algorithm":"NONE","lookup_kind":"dni","mask_visible_last":3}'::jsonb),
  ('identity_document_types', 'CE', 'Carné de Extranjería', 2, true, true, '{"person_types":["NATURAL"],"min_length":9,"max_length":12,"pattern":"^[A-Za-z0-9]{9,12}$","check_algorithm":"NONE","lookup_kind":"ce","mask_visible_last":3}'::jsonb),
  ('identity_document_types', 'RUC', 'RUC - Registro Único de Contribuyentes', 3, true, true, '{"person_types":["NATURAL","JURIDICA"],"min_length":11,"max_length":11,"pattern":"^\\d{11}$","check_algorithm":"RUC_MOD11","lookup_kind":"ruc","mask_visible_last":4}'::jsonb),
  ('identity_document_types', 'PASAPORTE', 'Pasaporte', 4, true, false, '{"person_types":["NATURAL"],"min_length":6,"max_length":12,"pattern":"^[A-Za-z0-9]{6,12}$","check_algorithm":"NONE","lookup_kind":"passport","mask_visible_last":3}'::jsonb),
  ('identity_document_types', 'OTRO', 'Otro Documento', 5, true, false, '{"person_types":["NATURAL","JURIDICA"],"min_length":3,"max_length":20,"pattern":"^[A-Za-z0-9-]{3,20}$","check_algorithm":"NONE","lookup_kind":"other","mask_visible_last":2}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.3 case_priorities
insert into public.catalog_items (catalog_code, code, label, sort_order, color, is_system, is_active, metadata) values
  ('case_priorities', 'LOW', 'Baja', 1, 'muted', true, true, '{"rank":1}'::jsonb),
  ('case_priorities', 'NORMAL', 'Normal', 2, 'info', true, true, '{"rank":2}'::jsonb),
  ('case_priorities', 'HIGH', 'Alta', 3, 'warning', true, true, '{"rank":3}'::jsonb),
  ('case_priorities', 'URGENT', 'Urgente', 4, 'danger', true, true, '{"rank":4}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.4 case_statuses
insert into public.catalog_items (catalog_code, code, label, sort_order, color, is_system, is_active, metadata) values
  ('case_statuses', 'DRAFT', 'Borrador', 1, 'muted', true, true, '{"category":"DRAFT"}'::jsonb),
  ('case_statuses', 'OPEN', 'Abierto', 2, 'info', true, true, '{"category":"ACTIVE"}'::jsonb),
  ('case_statuses', 'IN_PROGRESS', 'En Trámite', 3, 'info', true, true, '{"category":"ACTIVE"}'::jsonb),
  ('case_statuses', 'ON_HOLD', 'En Espera / Pausado', 4, 'warning', true, true, '{"category":"PAUSED"}'::jsonb),
  ('case_statuses', 'COMPLETED', 'Concluido', 5, 'success', true, true, '{"category":"DONE"}'::jsonb),
  ('case_statuses', 'CANCELLED', 'Cancelado', 6, 'danger', true, true, '{"category":"CANCELLED"}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.5 recurrence_frequencies
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active, metadata) values
  ('recurrence_frequencies', 'MENSUAL', 'Mensual', 1, true, true, '{"interval_unit":"month","interval_count":1}'::jsonb),
  ('recurrence_frequencies', 'TRIMESTRAL', 'Trimestral', 2, true, true, '{"interval_unit":"month","interval_count":3}'::jsonb),
  ('recurrence_frequencies', 'SEMESTRAL', 'Semestral', 3, true, true, '{"interval_unit":"month","interval_count":6}'::jsonb),
  ('recurrence_frequencies', 'ANUAL', 'Anual', 4, true, true, '{"interval_unit":"year","interval_count":1}'::jsonb),
  ('recurrence_frequencies', 'PERSONALIZADA', 'Personalizada', 5, true, true, '{"custom":true}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.6 case_categories
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('case_categories', 'SUCESION_INTESTADA', 'Sucesión Intestada', 1, true, true),
  ('case_categories', 'SUCESION_TESTADA', 'Sucesión Testada', 2, true, true),
  ('case_categories', 'TRANSFERENCIA_BIEN', 'Transferencia de Bien Heredado', 3, true, true),
  ('case_categories', 'TRAMITE_DOCUMENTARIO', 'Trámite Documentario Genérico', 4, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.7 document_categories
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('document_categories', 'INFORME', 'Informe', 1, true, true),
  ('document_categories', 'CONTRATO', 'Contrato', 2, true, true),
  ('document_categories', 'MINUTA', 'Minuta', 3, true, true),
  ('document_categories', 'CARTA', 'Carta', 4, true, true),
  ('document_categories', 'PODER', 'Poder', 5, true, true),
  ('document_categories', 'OFICIO', 'Oficio', 6, true, true),
  ('document_categories', 'SOLICITUD', 'Solicitud', 7, true, true),
  ('document_categories', 'RESOLUCION', 'Resolución', 8, true, true),
  ('document_categories', 'ANEXO', 'Anexo', 9, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.8 party_roles
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('party_roles', 'CAUSANTE', 'Causante', 1, true, true),
  ('party_roles', 'HEREDERO', 'Heredero', 2, true, true),
  ('party_roles', 'REPRESENTANTE', 'Representante Legal', 3, true, true),
  ('party_roles', 'CURADOR', 'Curador', 4, true, true),
  ('party_roles', 'OTRO', 'Otro Interviniente', 5, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.9 relationship_types
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('relationship_types', 'CONYUGE', 'Cónyuge', 1, true, true),
  ('relationship_types', 'CONVIVIENTE', 'Conviviente', 2, true, true),
  ('relationship_types', 'HIJO', 'Hijo / Hija', 3, true, true),
  ('relationship_types', 'PADRE', 'Padre', 4, true, true),
  ('relationship_types', 'MADRE', 'Madre', 5, true, true),
  ('relationship_types', 'HERMANO', 'Hermano / Hermana', 6, true, true),
  ('relationship_types', 'NIETO', 'Nieto / Nieta', 7, true, true),
  ('relationship_types', 'OTRO', 'Otro Parentesco', 8, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.10 heir_statuses
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('heir_statuses', 'PRESUNTO', 'Presunto', 1, true, true),
  ('heir_statuses', 'CONFIRMADO', 'Confirmado', 2, true, true),
  ('heir_statuses', 'EXCLUIDO', 'Excluido', 3, true, true),
  ('heir_statuses', 'RENUNCIANTE', 'Renunciante', 4, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.11 asset_types
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('asset_types', 'INMUEBLE', 'Inmueble / Predio', 1, true, true),
  ('asset_types', 'VEHICULO', 'Vehículo', 2, true, true),
  ('asset_types', 'CUENTA_BANCARIA', 'Cuenta Bancaria / Depósito', 3, true, true),
  ('asset_types', 'PARTICIPACION_EMPRESARIAL', 'Participación Societaria / Acciones', 4, true, true),
  ('asset_types', 'MUEBLE', 'Bien Mueble Registrable', 5, true, true),
  ('asset_types', 'OTRO', 'Otro Activo', 6, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.12 asset_statuses
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('asset_statuses', 'IDENTIFICADO', 'Identificado', 1, true, true),
  ('asset_statuses', 'VERIFICADO', 'Verificado Registralmente', 2, true, true),
  ('asset_statuses', 'TRANSFERIDO', 'Transferido / Adjudicado', 3, true, true),
  ('asset_statuses', 'EN_LITIGIO', 'En Litigio / Disputa', 4, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.13 liability_types
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('liability_types', 'TRIBUTARIA', 'Deuda Tributaria (SUNAT/Municipal)', 1, true, true),
  ('liability_types', 'BANCARIA', 'Deuda Financiera / Bancaria', 2, true, true),
  ('liability_types', 'PERSONAL', 'Deuda Personal / Comercial', 3, true, true),
  ('liability_types', 'OTRA', 'Otra Deuda', 4, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.14 liability_statuses
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('liability_statuses', 'IDENTIFICADA', 'Identificada', 1, true, true),
  ('liability_statuses', 'VERIFICADA', 'Verificada', 2, true, true),
  ('liability_statuses', 'PAGADA', 'Pagada / Extinguida', 3, true, true),
  ('liability_statuses', 'DISPUTADA', 'En Disputa', 4, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.15 external_entity_types
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('external_entity_types', 'NOTARIA', 'Notaría', 1, true, true),
  ('external_entity_types', 'ESTUDIO_ABOGADOS', 'Estudio de Abogados', 2, true, true),
  ('external_entity_types', 'SUNARP', 'Oficina Registral SUNARP', 3, true, true),
  ('external_entity_types', 'BANCO', 'Entidad Financiera / Banco', 4, true, true),
  ('external_entity_types', 'SUNAT', 'Administración Tributaria SUNAT', 5, true, true),
  ('external_entity_types', 'MUNICIPALIDAD', 'Municipalidad', 6, true, true),
  ('external_entity_types', 'OTRA', 'Otra Entidad', 7, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.16 filing_kinds
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('filing_kinds', 'SOLICITUD_NOTARIAL', 'Solicitud Notarial', 1, true, true),
  ('filing_kinds', 'ANOTACION_PREVENTIVA', 'Anotación Preventiva', 2, true, true),
  ('filing_kinds', 'PUBLICACION_EDICTO', 'Publicación de Edicto', 3, true, true),
  ('filing_kinds', 'TITULO_SUNARP', 'Presentación de Título SUNARP', 4, true, true),
  ('filing_kinds', 'ESCRITURA_PUBLICA', 'Protocolización / Escritura Pública', 5, true, true),
  ('filing_kinds', 'DERIVACION_ABOGADO', 'Derivación a Abogado Patrocinante', 6, true, true),
  ('filing_kinds', 'OTRO', 'Otro Trámite Externo', 7, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.17 filing_statuses
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active, metadata) values
  ('filing_statuses', 'PENDIENTE', 'Pendiente', 1, true, true, '{"category":"PENDING"}'::jsonb),
  ('filing_statuses', 'PRESENTADO', 'Presentado', 2, true, true, '{"category":"SUBMITTED"}'::jsonb),
  ('filing_statuses', 'OBSERVADO', 'Observado', 3, true, true, '{"category":"OBSERVED"}'::jsonb),
  ('filing_statuses', 'CONCLUIDO', 'Inscrito / Concluido', 4, true, true, '{"category":"DONE"}'::jsonb),
  ('filing_statuses', 'RECHAZADO', 'Rechazado / Tachado', 5, true, true, '{"category":"REJECTED"}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.18 case_routes
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('case_routes', 'POR_DEFINIR', 'Por Definir', 1, true, true),
  ('case_routes', 'NOTARIAL', 'Vía Notarial', 2, true, true),
  ('case_routes', 'JUDICIAL', 'Vía Judicial', 3, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.19 cash_categories
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active, metadata) values
  ('cash_categories', 'GASTOS_NOTARIALES', 'Gastos Notariales', 1, true, true, '{"type":"EXPENSE"}'::jsonb),
  ('cash_categories', 'TASAS_REGISTRALES', 'Tasas Registrales SUNARP', 2, true, true, '{"type":"EXPENSE"}'::jsonb),
  ('cash_categories', 'PUBLICACIONES', 'Publicaciones de Edictos', 3, true, true, '{"type":"EXPENSE"}'::jsonb),
  ('cash_categories', 'SERVICIOS_TERCEROS', 'Servicios de Terceros y Movilidad', 4, true, true, '{"type":"EXPENSE"}'::jsonb),
  ('cash_categories', 'OTROS', 'Otros Gastos de Operación', 5, true, true, '{"type":"EXPENSE"}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.20 cash_account_types
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('cash_account_types', 'CASH', 'Efectivo en Caja', 1, true, true),
  ('cash_account_types', 'BANK', 'Cuenta Bancaria', 2, true, true),
  ('cash_account_types', 'CARD', 'Tarjeta Corporativa', 3, true, true),
  ('cash_account_types', 'OTHER', 'Otro Medio', 4, true, true)
on conflict (catalog_code, code) do nothing;

-- 2.21 currencies
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active, metadata) values
  ('currencies', 'PEN', 'Sol Peruano', 1, true, true, '{"symbol":"S/","decimals":2,"is_default":true}'::jsonb),
  ('currencies', 'USD', 'Dólar Estadounidense', 2, true, true, '{"symbol":"$","decimals":2,"is_default":false}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.22 countries
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active, metadata) values
  ('countries', 'PE', 'Perú', 1, true, true, '{"code_iso":"PER"}'::jsonb)
on conflict (catalog_code, code) do nothing;

-- 2.23 marital_statuses (00-maestro §4.5)
insert into public.catalog_items (catalog_code, code, label, sort_order, is_system, is_active) values
  ('marital_statuses', 'SOLTERO', 'Soltero / Soltera', 1, true, true),
  ('marital_statuses', 'CASADO', 'Casado / Casada', 2, true, true),
  ('marital_statuses', 'VIUDO', 'Viudo / Viuda', 3, true, true),
  ('marital_statuses', 'DIVORCIADO', 'Divorciado / Divorciada', 4, true, true),
  ('marital_statuses', 'CONVIVIENTE', 'Conviviente', 5, true, true)
on conflict (catalog_code, code) do nothing;

-- ============================================================================
-- 3. FEATURE FLAGS (v2.1 §3.5 y dominio - 28 keys exactas)
-- ============================================================================

insert into public.feature_flags (key, module, label, description, is_enabled, is_locked, depends_on) values
  -- Módulos principales
  ('module.cash', 'cash', 'Caja Chica', 'Control de libro de ingresos y egresos, solicitudes y arqueos', true, false, '{}'),
  ('module.quotes', 'quotes', 'Cotizaciones y Proveedores', 'Gestión de cotizaciones de proveedores para trámites', true, false, '{}'),
  ('module.ai', 'ai', 'Asistente IA de Documentos', 'Recomendación y sugerencia de documentos para revisión legal (D3)', false, false, '{}'),
  ('module.knowledge_base', 'ai', 'Base de Conocimiento IA', 'Base de conocimiento vectorial para asistencia documental', false, false, '{"module.ai"}'),
  ('module.telegram', 'integrations', 'Alertas por Telegram', 'Envío de notificaciones operativas vía bot de Telegram', false, false, '{}'),
  ('module.recurring_cases', 'cases', 'Casos Recurrentes', 'Programación y apertura periódica de trámites documentarios', true, false, '{}'),
  ('module.kanban', 'cases', 'Vista Kanban de Procesos', 'Tablero visual de procesos y avance de casos', true, false, '{}'),
  ('module.case_parties', 'cases', 'Partes del Caso', 'Gestión detallada de intervinientes y cuotas sucesorias', true, false, '{}'),
  ('module.estate_inventory', 'cases', 'Inventario de Patrimonio', 'Gestión de bienes y deudas de la masa hereditaria', true, false, '{}'),
  ('module.external_filings', 'filings', 'Trámites Externos', 'Seguimiento de gestiones notariales y registrales', true, false, '{}'),
  ('module.monitoring', 'admin', 'Monitoreo de Sistema', 'Diagnóstico de latencia, jobs y estado del motor Fastify', true, false, '{}'),
  ('module.reports_export', 'reports', 'Exportación de Reportes', 'Exportación de métricas y datos a formato Excel y PDF', true, false, '{}'),

  -- Funciones de clientes y casos
  ('clients.external_lookup', 'clients', 'Consulta Automática DNI/RUC', 'Búsqueda de identidad con proveedor APIINTI', true, false, '{}'),
  ('clients.mask_identity', 'clients', 'Enmascarar Documentos', 'Oculta dígitos intermedios de documentos en listados', true, false, '{}'),
  ('cases.closing_gates', 'cases', 'Compuertas de Cierre (M1)', 'Bloquea el cierre de casos con procesos o documentos abiertos', true, false, '{}'),
  ('cases.confidential', 'cases', 'Casos Confidenciales (M6)', 'Restringe visibilidad de casos confidenciales solo a asignados', true, false, '{}'),
  ('cases.stagnation_alerts', 'cases', 'Alertas de Estancamiento', 'Notifica cuando un caso no registra actividad en N días', true, false, '{}'),

  -- Funciones documentales
  ('docs.pdf_generation', 'documents', 'Generación de PDF', 'Conversión automática de plantillas DOCX a formato PDF', true, false, '{}'),
  ('docs.require_approval', 'documents', 'Aprobación Legal Obligatoria', 'Exige visto bueno de abogado antes de emitir documentos finales', true, false, '{}'),
  ('docs.four_eyes', 'documents', 'Principio de Cuatro Ojos', 'Quien aprueba el documento debe ser distinto de quien lo generó', false, false, '{}'),
  ('docs.draft_watermark', 'documents', 'Marca de Agua "BORRADOR"', 'Inserta marca de agua visible en versiones no aprobadas', true, false, '{}'),

  -- Seguridad y UI
  ('security.mfa_admin', 'security', 'MFA Obligatorio para Administrador', 'Exige autenticación de dos factores para usuarios con rol ADMIN', true, false, '{}'),
  ('security.mfa_cash', 'security', 'MFA Obligatorio para Caja Chica', 'Exige autenticación de dos factores para rol CASHIER', true, false, '{}'),
  ('ai.rules_only_mode', 'ai', 'Modo Solo Reglas para IA', 'Genera recomendaciones documentales puramente por motor de reglas', false, false, '{}'),
  ('ui.user_theme_choice', 'appearance', 'Preferencia de Tema por Usuario', 'Permite a cada usuario elegir entre tema Claro y Oscuro', true, false, '{}'),

  -- Núcleo y protección (is_locked = true)
  ('audit.enabled', 'security', 'Pistas de Auditoría Activas', 'Auditoría append-only obligatoria en toda la plataforma', true, true, '{}'),
  ('rls.enforced', 'security', 'Seguridad por Fila (RLS)', 'Aplicación estricta de políticas RLS en base de datos', true, true, '{}'),

  -- Almacenamiento
  ('storage.compress_uploads', 'storage', 'Compresión en Navegador', 'Comprime imágenes y documentos antes de transferirlos al bucket', true, false, '{}')
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      module = excluded.module,
      is_locked = excluded.is_locked,
      depends_on = excluded.depends_on;

-- ============================================================================
-- 4. DEFINICIONES DE PARÁMETROS (setting_definitions)
-- ============================================================================

insert into public.setting_definitions (key, category, label, description, value_type, default_value, constraints, sort_order) values
  -- General
  ('general.company_name', 'general', 'Nombre de la Empresa', 'Razón social o denominación comercial que figura en el sistema', 'string', '"WorkFlow Sucesorio"'::jsonb, '{"min_length":2,"max_length":100}'::jsonb, 1),
  ('general.logo_url', 'general', 'Logotipo Corporativo', 'Ruta de la imagen de logotipo almacenada en el bucket logos', 'string', '""'::jsonb, '{}'::jsonb, 2),
  ('general.language', 'general', 'Idioma de Interfaz', 'Idioma regional predeterminado de la plataforma', 'enum', '"es-PE"'::jsonb, '{"options":["es-PE"]}'::jsonb, 3),
  ('general.timezone', 'general', 'Zona Horaria', 'Zona horaria operativa para cómputo de plazos y auditoría', 'enum', '"America/Lima"'::jsonb, '{"options":["America/Lima"]}'::jsonb, 4),
  ('general.currency_default', 'general', 'Moneda Predeterminada', 'Moneda utilizada por defecto en cotizaciones y caja chica', 'enum', '"PEN"'::jsonb, '{"options":["PEN","USD"]}'::jsonb, 5),
  ('general.date_format', 'general', 'Formato de Fechas', 'Patrón visual para renderizado de fechas en interfaz y reportes', 'string', '"DD/MM/YYYY"'::jsonb, '{}'::jsonb, 6),
  ('general.number_format', 'general', 'Formato Numérico', 'Convención de separador de miles y decimales', 'string', '"1,234.56"'::jsonb, '{}'::jsonb, 7),

  -- Apariencia
  ('appearance.theme', 'appearance', 'Tema Visual', 'Paleta y modo de apariencia por defecto', 'enum', '"light"'::jsonb, '{"options":["light","dark","corporate","custom"]}'::jsonb, 1),
  ('appearance.primary_color', 'appearance', 'Color Primario', 'Tono primario para botones e indicadores activos', 'color', '"#2563eb"'::jsonb, '{}'::jsonb, 2),
  ('appearance.secondary_color', 'appearance', 'Color Secundario', 'Tono secundario para tarjetas y paneles', 'color', '"#f1f5f9"'::jsonb, '{}'::jsonb, 3),
  ('appearance.font_family', 'appearance', 'Tipografía Base', 'Familia tipográfica de la aplicación', 'string', '"Inter"'::jsonb, '{}'::jsonb, 4),
  ('appearance.density', 'appearance', 'Densidad de Interfaz', 'Espaciado general en tablas y formularios', 'enum', '"normal"'::jsonb, '{"options":["compact","normal","comfortable"]}'::jsonb, 5),
  ('appearance.base_font_size', 'appearance', 'Tamaño de Fuente Base', 'Tamaño de fuente raíz en píxeles', 'number', '14'::jsonb, '{"min":12,"max":18}'::jsonb, 6),

  -- Casos
  ('cases.number_format', 'cases', 'Patrón Correlativo de Casos', 'Formato para numeración automática de expedientes', 'string', '"{YYYY}-{SEQ:6}"'::jsonb, '{}'::jsonb, 1),
  ('cases.default_priority', 'cases', 'Prioridad Inicial', 'Prioridad asignada automáticamente a nuevos casos', 'enum', '"NORMAL"'::jsonb, '{"options":["LOW","NORMAL","HIGH","URGENT"]}'::jsonb, 2),
  ('cases.default_due_days', 'cases', 'Plazo General Estimado (Días)', 'Días útiles estimados para trámite regular', 'number', '30'::jsonb, '{"min":1,"max":365}'::jsonb, 3),
  ('cases.allow_reopen', 'cases', 'Permitir Reapertura de Casos', 'Habilita a usuarios con permiso reabrir casos concluidos', 'boolean', 'false'::jsonb, '{}'::jsonb, 4),

  -- Alertas
  ('alerts.due_days', 'alerts', 'Anticipación de Alertas por Vencimiento', 'Días previos a la fecha límite para emitir alertas preventivas', 'list', '[3, 1, 0]'::jsonb, '{}'::jsonb, 1),
  ('alerts.stagnation_default_days', 'alerts', 'Umbral de Estancamiento (Días)', 'Días continuos sin actividad para declarar caso estancado', 'number', '5'::jsonb, '{"min":1,"max":90}'::jsonb, 2),
  ('alerts.working_hours', 'alerts', 'Horario de Atención Operativa', 'Rango diario para conteo de horas laborales', 'string', '"08:00 - 18:00"'::jsonb, '{}'::jsonb, 3),
  ('alerts.digest_time', 'alerts', 'Hora del Resumen Diario', 'Hora de generación del reporte de tareas pendientes', 'time', '"07:30"'::jsonb, '{}'::jsonb, 4),
  ('alerts.default_channels', 'alerts', 'Canales de Alerta Activos', 'Canales habilitados para notificación', 'list', '["in_app"]'::jsonb, '{}'::jsonb, 5),

  -- Documentos
  ('documents.max_file_mb', 'documents', 'Tope Máximo por Archivo (MB)', 'Tamaño máximo admitido al subir un expediente', 'number', '10'::jsonb, '{"min":1,"max":50}'::jsonb, 1),
  ('documents.allowed_mime', 'documents', 'Formatos Permitidos', 'Tipos MIME aceptados en la carga documental', 'list', '["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/jpeg","image/png"]'::jsonb, '{}'::jsonb, 2),
  ('documents.watermark_text', 'documents', 'Texto de Marca de Agua', 'Texto colocado en documentos en estado borrador', 'string', '"BORRADOR - SIN VALIDEZ LEGAL"'::jsonb, '{}'::jsonb, 3),

  -- Clientes
  ('clients.mask_visible_last', 'clients', 'Dígitos Visibles en Documentos', 'Cantidad de dígitos visibles al enmascarar DNI/CE', 'number', '3'::jsonb, '{"min":1,"max":6}'::jsonb, 1),
  ('clients.lookup_cache_days', 'clients', 'Vigencia de Caché DNI/RUC (Días)', 'Días de retención de respuestas APIINTI antes de reconsultar', 'number', '30'::jsonb, '{"min":1,"max":180}'::jsonb, 2),

  -- Caja Chica
  ('cash.require_support_over', 'cash', 'Exigir Comprobante desde (PEN)', 'Monto a partir del cual el gasto requiere documento de soporte', 'number', '50.00'::jsonb, '{"min":0}'::jsonb, 1),
  ('cash.approval_over_amount', 'cash', 'Aprobación Previa Obligatoria (PEN)', 'Monto límite para desembolsos sin autorización del administrador', 'number', '300.00'::jsonb, '{"min":0}'::jsonb, 2),
  ('cash.min_balance_alert', 'cash', 'Saldo Mínimo de Alerta (PEN)', 'Umbral de reposición urgente de fondos en caja', 'number', '200.00'::jsonb, '{"min":0}'::jsonb, 3),

  -- Seguridad
  ('security.session_idle_minutes', 'security', 'Cierre de Sesión por Inactividad (Min)', 'Minutos sin interacción antes de solicitar reconexión', 'number', '30'::jsonb, '{"min":5,"max":240}'::jsonb, 1),
  ('security.upload_scan', 'security', 'Escaneo Antivirus de Archivos', 'Verificación de integridad y seguridad de adjuntos', 'boolean', 'true'::jsonb, '{}'::jsonb, 2),

  -- Integraciones (Sin secretos; solo endpoints, proveedores y cuotas)
  ('integrations.identity_lookup_provider', 'integrations', 'Proveedor de Identidad', 'Adaptador activo para consultas de DNI/RUC', 'string', '"apiinti"'::jsonb, '{}'::jsonb, 1),
  ('integrations.identity_lookup_base_url', 'integrations', 'URL Base de API de Identidad', 'Endpoint base para el adaptador de consulta', 'string', '"https://apiinti.com/api/v1"'::jsonb, '{}'::jsonb, 2),
  ('integrations.identity_lookup_timeout_ms', 'integrations', 'Timeout de Consulta (ms)', 'Tiempo máximo de espera antes de permitir alta manual', 'number', '5000'::jsonb, '{"min":1000,"max":15000}'::jsonb, 3),
  ('integrations.identity_lookup_monthly_quota', 'integrations', 'Cuota Mensual Contratada', 'Límite de consultas mensuales según el plan del proveedor', 'number', '500'::jsonb, '{"min":10}'::jsonb, 4),
  ('integrations.telegram_bot_username', 'integrations', 'Usuario del Bot de Telegram', 'Alias del bot para suscripción de alertas del personal', 'string', '""'::jsonb, '{}'::jsonb, 5),

  -- Monitoreo y Plataforma
  ('monitoring.check_interval_min', 'monitoring', 'Intervalo de Diagnóstico (Min)', 'Frecuencia de sondeo del estado de salud de servicios', 'number', '5'::jsonb, '{"min":1,"max":60}'::jsonb, 1),
  ('monitoring.latency_warn_ms', 'monitoring', 'Alerta de Latencia Elevada (ms)', 'Umbral de advertencia de rendimiento de la base de datos', 'number', '800'::jsonb, '{"min":100}'::jsonb, 2),
  ('platform.tier', 'platform', 'Nivel de Plataforma Operativa', 'Plan de infraestructura activo', 'enum', '"FREE"'::jsonb, '{"options":["FREE","PAID"]}'::jsonb, 3),
  ('platform.jobs_mode', 'platform', 'Modo de Ejecución de Tareas', 'Mecanismo de despacho de cola de trabajos en segundo plano', 'enum', '"TICK"'::jsonb, '{"options":["TICK","CONTINUOUS"]}'::jsonb, 4),

  -- Almacenamiento
  ('storage.primary_backend', 'storage', 'Almacén Primario Activo', 'Proveedor principal de almacenamiento de versiones', 'enum', '"supabase"'::jsonb, '{"options":["supabase","r2"]}'::jsonb, 1),
  ('storage.backup_backend', 'storage', 'Destino de Respaldo Cifrado', 'Destino secundario para duplicación de seguridad', 'enum', '"none"'::jsonb, '{"options":["none","gdrive_backup","r2"]}'::jsonb, 2),
  ('storage.image_max_px', 'storage', 'Dimensión Máxima de Imágenes (px)', 'Resolución tope para optimización antes de subida', 'number', '2000'::jsonb, '{"min":800,"max":4000}'::jsonb, 3),
  ('storage.usage_warn_percent', 'storage', 'Umbral de Alerta de Espacio (%)', 'Porcentaje de ocupación para advertencia de cuota', 'number', '80'::jsonb, '{"min":50,"max":95}'::jsonb, 4),
  ('storage.draft_retention_days', 'storage', 'Retención de Borradores (Días)', 'Días de gracia antes de purga de borradores no aprobados', 'number', '30'::jsonb, '{"min":1,"max":180}'::jsonb, 5)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      category = excluded.category,
      value_type = excluded.value_type,
      default_value = excluded.default_value,
      constraints = excluded.constraints,
      sort_order = excluded.sort_order;

-- ============================================================================
-- 5. VALORES INICIALES DE PARÁMETROS (system_settings)
-- ============================================================================

insert into public.system_settings (key, value)
select key, default_value
  from public.setting_definitions
on conflict (key) do nothing;

commit;
