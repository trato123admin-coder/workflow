'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sliders,
  Palette,
  ToggleRight,
  UserCheck,
  Briefcase,
  GitFork,
  FileText,
  Users,
  Bell,
  Coins,
  Cpu,
  Shield,
  Database,
  FileCode,
  HardDrive,
  Settings as SettingsIcon,
  CheckCircle2,
  Clock,
} from 'lucide-react';

import { AppShell } from '../../components/layout/AppShell';
import { ThemePicker } from '../../components/settings/ThemePicker';
import { CatalogEditor } from '../../components/settings/CatalogEditor';
import { FeatureFlagsManager } from '../../components/settings/FeatureFlagsManager';
import { CustomFieldsManager } from '../../components/settings/CustomFieldsManager';
import { AdvancedSettings } from '../../components/settings/AdvancedSettings';
import { DynamicSettingsSection } from '../../components/settings/DynamicSettingsSection';
import { WorkflowModelsManager } from '../../components/settings/WorkflowModelsManager';

import type {
  Catalog,
  CatalogItem,
  FeatureFlag,
  SettingDefinition,
  SystemSetting,
  CustomFieldDefinition,
  SettingsHistoryItem,
} from '@workflow/shared';

// Datos de demostración y valores iniciales en memoria para cliente
const INITIAL_CATALOGS: Catalog[] = [
  {
    code: 'identity_document_types',
    name: 'Tipos de Documento de Identidad',
    module: 'clients',
    allow_new_items: true,
    item_schema: {},
    is_system: true,
  },
  {
    code: 'person_types',
    name: 'Tipos de Persona',
    module: 'clients',
    allow_new_items: false,
    item_schema: {},
    is_system: true,
  },
  {
    code: 'case_priorities',
    name: 'Prioridades de Caso',
    module: 'cases',
    allow_new_items: true,
    item_schema: {},
    is_system: true,
  },
  {
    code: 'case_statuses',
    name: 'Estados de Caso',
    module: 'cases',
    allow_new_items: false,
    item_schema: {},
    is_system: true,
  },
  {
    code: 'party_roles',
    name: 'Roles de Intervinientes',
    module: 'cases',
    allow_new_items: true,
    item_schema: {},
    is_system: true,
  },
  {
    code: 'asset_types',
    name: 'Tipos de Bienes',
    module: 'cases',
    allow_new_items: true,
    item_schema: {},
    is_system: true,
  },
  {
    code: 'workflow_statuses',
    name: 'Estados de Workflow',
    module: 'workflow',
    allow_new_items: true,
    item_schema: {},
    is_system: true,
  },
];

const INITIAL_CATALOG_ITEMS: CatalogItem[] = [
  {
    catalog_code: 'identity_document_types',
    code: 'DNI',
    label: 'DNI - Documento Nacional de Identidad',
    is_active: true,
    is_system: true,
    sort_order: 1,
    metadata: {},
  },
  {
    catalog_code: 'identity_document_types',
    code: 'CE',
    label: 'Carné de Extranjería',
    is_active: true,
    is_system: true,
    sort_order: 2,
    metadata: {},
  },
  {
    catalog_code: 'identity_document_types',
    code: 'RUC',
    label: 'RUC - Registro Único de Contribuyentes',
    is_active: true,
    is_system: true,
    sort_order: 3,
    metadata: {},
  },
  {
    catalog_code: 'identity_document_types',
    code: 'PASAPORTE',
    label: 'Pasaporte',
    is_active: false,
    is_system: true,
    sort_order: 4,
    metadata: {},
  },
  {
    catalog_code: 'identity_document_types',
    code: 'OTRO',
    label: 'Otro Documento',
    is_active: false,
    is_system: true,
    sort_order: 5,
    metadata: {},
  },
  {
    catalog_code: 'case_priorities',
    code: 'LOW',
    label: 'Baja',
    is_active: true,
    is_system: true,
    sort_order: 1,
    metadata: {},
  },
  {
    catalog_code: 'case_priorities',
    code: 'NORMAL',
    label: 'Normal',
    is_active: true,
    is_system: true,
    sort_order: 2,
    metadata: {},
  },
  {
    catalog_code: 'case_priorities',
    code: 'HIGH',
    label: 'Alta',
    is_active: true,
    is_system: true,
    sort_order: 3,
    metadata: {},
  },
  {
    catalog_code: 'case_priorities',
    code: 'URGENT',
    label: 'Urgente',
    is_active: true,
    is_system: true,
    sort_order: 4,
    metadata: {},
  },
];

const INITIAL_FLAGS: FeatureFlag[] = [
  {
    key: 'module.cash',
    module: 'cash',
    label: 'Caja Chica',
    is_enabled: true,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'module.quotes',
    module: 'quotes',
    label: 'Cotizaciones y Proveedores',
    is_enabled: true,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'module.ai',
    module: 'ai',
    label: 'Asistente IA de Documentos',
    is_enabled: false,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'module.knowledge_base',
    module: 'ai',
    label: 'Base de Conocimiento',
    is_enabled: false,
    is_locked: false,
    depends_on: ['module.ai'],
    requires_config: [],
    config: {},
  },
  {
    key: 'module.telegram',
    module: 'integrations',
    label: 'Alertas por Telegram',
    is_enabled: false,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'module.recurring_cases',
    module: 'cases',
    label: 'Casos Recurrentes',
    is_enabled: true,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'module.kanban',
    module: 'cases',
    label: 'Vista Kanban de Procesos',
    is_enabled: true,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'security.mfa_admin',
    module: 'security',
    label: 'MFA Obligatorio para Administrador',
    is_enabled: true,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'security.mfa_cash',
    module: 'security',
    label: 'MFA Obligatorio para Caja Chica',
    is_enabled: true,
    is_locked: false,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'audit.enabled',
    module: 'security',
    label: 'Pistas de Auditoría',
    is_enabled: true,
    is_locked: true,
    depends_on: [],
    requires_config: [],
    config: {},
  },
  {
    key: 'rls.enforced',
    module: 'security',
    label: 'Seguridad a Nivel de Fila (RLS)',
    is_enabled: true,
    is_locked: true,
    depends_on: [],
    requires_config: [],
    config: {},
  },
];

const INITIAL_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    entity: 'case',
    code: 'num_partida',
    label: 'N.º de Partida Registral',
    data_type: 'TEXT',
    is_required: true,
    validation: {},
    is_active: true,
    is_system: false,
    sort_order: 1,
    applies_to: {},
  },
];

const GENERAL_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'general.company_name',
    category: 'general',
    label: 'Nombre de la Empresa',
    value_type: 'string',
    default_value: 'WorkFlow Sucesorio',
    constraints: { min_length: 2 },
    edit_permission: 'settings.manage',
    sort_order: 1,
  },
  {
    key: 'general.language',
    category: 'general',
    label: 'Idioma Regional',
    value_type: 'enum',
    default_value: 'es-PE',
    constraints: { options: ['es-PE'] },
    edit_permission: 'settings.manage',
    sort_order: 2,
  },
  {
    key: 'general.timezone',
    category: 'general',
    label: 'Zona Horaria',
    value_type: 'enum',
    default_value: 'America/Lima',
    constraints: { options: ['America/Lima'] },
    edit_permission: 'settings.manage',
    sort_order: 3,
  },
  {
    key: 'general.currency_default',
    category: 'general',
    label: 'Moneda Predeterminada',
    value_type: 'enum',
    default_value: 'PEN',
    constraints: { options: ['PEN', 'USD'] },
    edit_permission: 'settings.manage',
    sort_order: 4,
  },
  {
    key: 'general.date_format',
    category: 'general',
    label: 'Formato de Fechas',
    value_type: 'string',
    default_value: 'DD/MM/YYYY',
    constraints: {},
    edit_permission: 'settings.manage',
    sort_order: 5,
  },
];

const CASES_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'cases.number_format',
    category: 'cases',
    label: 'Patrón Correlativo de Casos',
    value_type: 'string',
    default_value: '{YYYY}-{SEQ:6}',
    constraints: {},
    edit_permission: 'settings.manage',
    sort_order: 1,
  },
  {
    key: 'cases.default_priority',
    category: 'cases',
    label: 'Prioridad Inicial',
    value_type: 'enum',
    default_value: 'NORMAL',
    constraints: { options: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
    edit_permission: 'settings.manage',
    sort_order: 2,
  },
  {
    key: 'cases.default_due_days',
    category: 'cases',
    label: 'Plazo Estimado General (Días)',
    value_type: 'number',
    default_value: 30,
    constraints: { min: 1, max: 365 },
    edit_permission: 'settings.manage',
    sort_order: 3,
  },
  {
    key: 'cases.allow_reopen',
    category: 'cases',
    label: 'Permitir Reapertura de Casos',
    value_type: 'boolean',
    default_value: false,
    constraints: {},
    edit_permission: 'settings.manage',
    sort_order: 4,
  },
];

const ALERTS_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'alerts.stagnation_default_days',
    category: 'alerts',
    label: 'Umbral de Estancamiento (Días)',
    value_type: 'number',
    default_value: 5,
    constraints: { min: 1, max: 90 },
    edit_permission: 'settings.manage',
    sort_order: 1,
  },
  {
    key: 'alerts.working_hours',
    category: 'alerts',
    label: 'Horario Operativo',
    value_type: 'string',
    default_value: '08:00 - 18:00',
    constraints: {},
    edit_permission: 'settings.manage',
    sort_order: 2,
  },
  {
    key: 'alerts.digest_time',
    category: 'alerts',
    label: 'Hora del Resumen Diario',
    value_type: 'time',
    default_value: '07:30',
    constraints: {},
    edit_permission: 'settings.manage',
    sort_order: 3,
  },
];

const SECURITY_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'security.session_idle_minutes',
    category: 'security',
    label: 'Cierre de Sesión por Inactividad (Minutos)',
    value_type: 'number',
    default_value: 30,
    constraints: { min: 5, max: 240 },
    edit_permission: 'settings.manage',
    sort_order: 1,
  },
  {
    key: 'security.upload_scan',
    category: 'security',
    label: 'Escaneo de Archivos',
    value_type: 'boolean',
    default_value: true,
    constraints: {},
    edit_permission: 'settings.manage',
    sort_order: 2,
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('appearance');
  const [catalogs, setCatalogs] = useState<Catalog[]>(INITIAL_CATALOGS);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(INITIAL_CATALOG_ITEMS);
  const [flags, setFlags] = useState<FeatureFlag[]>(INITIAL_FLAGS);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(INITIAL_CUSTOM_FIELDS);
  const [history, setHistory] = useState<SettingsHistoryItem[]>([
    {
      id: '1',
      key: 'general.company_name',
      old_value: 'Empresa Demo',
      new_value: 'WorkFlow Sucesorio',
      reason: 'Configuración inicial',
      changed_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);

  // Handlers para catálogos
  const handleToggleCatalogItem = async (
    catalogCode: string,
    itemCode: string,
    nextActive: boolean,
  ) => {
    setCatalogItems((prev) =>
      prev.map((i) =>
        i.catalog_code === catalogCode && i.code === itemCode ? { ...i, is_active: nextActive } : i,
      ),
    );
    setHistory((prev) => [
      {
        id: String(Date.now()),
        key: `catalog.${catalogCode}.${itemCode}.is_active`,
        old_value: !nextActive,
        new_value: nextActive,
        reason: nextActive ? 'Activación de elemento' : 'Desactivación con diálogo de impacto',
        changed_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleCreateCatalogItem = async (item: {
    catalog_code: string;
    code: string;
    label: string;
    description?: string;
  }) => {
    const newItem: CatalogItem = {
      catalog_code: item.catalog_code,
      code: item.code,
      label: item.label,
      description: item.description,
      is_active: true,
      is_system: false,
      sort_order: catalogItems.length + 1,
      metadata: {},
    };
    setCatalogItems((prev) => [...prev, newItem]);
    setHistory((prev) => [
      {
        id: String(Date.now()),
        key: `catalog.${item.catalog_code}.${item.code}`,
        old_value: null,
        new_value: item.label,
        reason: 'Creación de elemento de catálogo personalizado',
        changed_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  // Handlers para Feature Flags
  const handleToggleFlag = async (key: string, nextEnabled: boolean, reason?: string) => {
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, is_enabled: nextEnabled } : f)));
    setHistory((prev) => [
      {
        id: String(Date.now()),
        key: `flag.${key}`,
        old_value: !nextEnabled,
        new_value: nextEnabled,
        reason: reason || (nextEnabled ? 'Habilitación de flag' : 'Deshabilitación de flag'),
        changed_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  // Handlers para Campos Personalizados
  const handleCreateCustomField = async (field: Partial<CustomFieldDefinition>) => {
    const newField: CustomFieldDefinition = {
      id: String(Date.now()),
      entity: field.entity || 'case',
      code: field.code || '',
      label: field.label || '',
      help_text: field.help_text,
      data_type: field.data_type || 'TEXT',
      options: field.options,
      is_required: field.is_required || false,
      validation: {},
      is_active: true,
      is_system: false,
      sort_order: customFields.length + 1,
      applies_to: {},
    };
    setCustomFields((prev) => [...prev, newField]);
    setHistory((prev) => [
      {
        id: String(Date.now()),
        key: `custom_field.${newField.entity}.${newField.code}`,
        old_value: null,
        new_value: newField.label,
        reason: 'Creación de campo personalizado dinámico',
        changed_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleToggleCustomField = async (id: string, nextActive: boolean) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, is_active: nextActive } : f)));
  };

  const navigationTabs = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'appearance', label: 'Apariencia', icon: Palette },
    { id: 'modules', label: 'Módulos', icon: ToggleRight },
    { id: 'clients', label: 'Clientes', icon: UserCheck },
    { id: 'cases', label: 'Casos', icon: Briefcase },
    { id: 'workflow', label: 'Workflow', icon: GitFork },
    { id: 'documents', label: 'Documentos', icon: FileText, isSkeleton: true },
    { id: 'users', label: 'Usuarios y Roles', icon: Users, isExternal: true },
    { id: 'alerts', label: 'Alertas', icon: Bell },
    { id: 'cash', label: 'Caja Chica', icon: Coins, isSkeleton: true },
    { id: 'integrations', label: 'Integraciones', icon: Cpu },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'catalogs', label: 'Catálogos', icon: Database },
    { id: 'custom_fields', label: 'Campos Personalizados', icon: FileCode },
    { id: 'storage', label: 'Almacenamiento', icon: HardDrive, isSkeleton: true },
    { id: 'advanced', label: 'Avanzado', icon: SettingsIcon },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Configuración' }]}>
      <div className="space-y-6">
        {/* Encabezado */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Configuración del Sistema (Settings)
          </h1>
          <p className="text-xs text-muted-foreground">
            Administre parámetros, catálogos, módulos y variables del sistema sin necesidad de
            desplegar código.
          </p>
        </div>

        {/* Layout en dos columnas: Menú lateral de pestañas + Contenido */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Menú lateral de Settings */}
          <aside className="md:col-span-3 space-y-1 rounded-xl border border-border bg-card p-2 shadow-sm">
            {navigationTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              if (tab.isExternal) {
                return (
                  <Link
                    key={tab.id}
                    href="/users"
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                    <span className="text-[10px] text-primary">Abrir →</span>
                  </Link>
                );
              }

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.isSkeleton && (
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded border border-current opacity-70">
                      Borrador
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Panel Principal */}
          <main className="md:col-span-9 rounded-xl border border-border bg-card p-6 shadow-sm min-h-[500px]">
            {/* General */}
            {activeTab === 'general' && (
              <DynamicSettingsSection
                title="Configuración General"
                description="Información básica de la empresa, zona horaria y formatos regionales."
                definitions={GENERAL_DEFINITIONS}
                values={{
                  'general.company_name': 'WorkFlow Sucesorio',
                  'general.language': 'es-PE',
                }}
              />
            )}

            {/* Apariencia */}
            {activeTab === 'appearance' && <ThemePicker />}

            {/* Módulos */}
            {activeTab === 'modules' && (
              <FeatureFlagsManager flags={flags} onToggleFlag={handleToggleFlag} />
            )}

            {/* Clientes */}
            {activeTab === 'clients' && (
              <div className="space-y-6 text-xs">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">Configuración de Clientes</h3>
                  <p className="text-muted-foreground">
                    Los tipos de persona y documentos admisibles provienen de los catálogos
                    correspondientes.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                  <p className="font-semibold text-foreground">Gestión de Catálogos de Clientes:</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalogs')}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                    >
                      Ir a Catálogo de Documentos de Identidad
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('custom_fields')}
                      className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground"
                    >
                      Ver Campos Personalizados de Clientes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Casos */}
            {activeTab === 'cases' && (
              <DynamicSettingsSection
                title="Configuración de Casos"
                description="Patrón de numeración correlativa, prioridades y reglas de cierre."
                definitions={CASES_DEFINITIONS}
                values={{
                  'cases.number_format': '{YYYY}-{SEQ:6}',
                  'cases.default_priority': 'NORMAL',
                }}
              />
            )}

            {/* Workflow (Sprint 3) */}
            {activeTab === 'workflow' && (
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">
                    Workflow y Modelos de Trámite
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Modelos versionados con compuertas de avance y dependencias (Sprint 3).
                  </p>
                </div>
                <WorkflowModelsManager />
              </div>
            )}

            {/* Documentos (Esqueleto Sprint 2) */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">Gestión Documental</h3>
                  <p className="text-xs text-muted-foreground">
                    Categorías documentales y límites de subida.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                  <p>
                    Tamaño máximo por archivo: <strong>10 MB</strong>
                  </p>
                  <p>
                    Marca de agua por defecto: <strong>BORRADOR - SIN VALIDEZ LEGAL</strong>
                  </p>
                  <p className="text-muted-foreground pt-2">
                    La generación de plantillas DOCX y motor documental completo se integran en el
                    Sprint 5.
                  </p>
                </div>
              </div>
            )}

            {/* Alertas */}
            {activeTab === 'alerts' && (
              <DynamicSettingsSection
                title="Alertas y Horarios"
                description="Umbrales de estancamiento, horarios laborales y notificaciones."
                definitions={ALERTS_DEFINITIONS}
                values={{ 'alerts.stagnation_default_days': 5, 'alerts.digest_time': '07:30' }}
              />
            )}

            {/* Caja (Esqueleto Sprint 2) */}
            {activeTab === 'cash' && (
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">Parámetros de Caja Chica</h3>
                  <p className="text-xs text-muted-foreground">
                    Umbrales de soporte y aprobación previa para movimientos.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                  <p>
                    Exigir soporte con comprobante desde: <strong>S/ 50.00</strong>
                  </p>
                  <p>
                    Aprobación previa del administrador desde: <strong>S/ 300.00</strong>
                  </p>
                  <p>
                    Saldo mínimo para alerta de reposición: <strong>S/ 200.00</strong>
                  </p>
                  <p className="text-muted-foreground pt-2">
                    El libro de caja y arqueos completos se habilitan en el Sprint 8.
                  </p>
                </div>
              </div>
            )}

            {/* Integraciones */}
            {activeTab === 'integrations' && (
              <div className="space-y-6 text-xs">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">
                    Estado de Integraciones Externas
                  </h3>
                  <p className="text-muted-foreground">
                    Verificación de servicios conectados. Los secretos y claves de API se mantienen
                    estrictamente en variables de entorno seguras.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-foreground">APIINTI (DNI / RUC)</h4>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-muted-foreground">
                      Adaptador de búsqueda de identidad para alta de clientes.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Configurado en entorno
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-foreground">Telegram Bot</h4>
                      <span className="text-[10px] text-amber-500 font-semibold">Pendiente</span>
                    </div>
                    <p className="text-muted-foreground">
                      Notificaciones operativas inmediatas para gestores y abogados.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                      Bot inactivo
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-foreground">Asistente IA</h4>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Apagado
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Módulo documental inteligente (D3). Nace apagado por decisión.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                      module.ai = false
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Seguridad */}
            {activeTab === 'security' && (
              <DynamicSettingsSection
                title="Políticas de Seguridad"
                description="Tiempos de inactividad y políticas obligatorias."
                definitions={SECURITY_DEFINITIONS}
                values={{ 'security.session_idle_minutes': 30, 'security.upload_scan': true }}
              />
            )}

            {/* Catálogos */}
            {activeTab === 'catalogs' && (
              <CatalogEditor
                catalogs={catalogs}
                items={catalogItems}
                onToggleActive={handleToggleCatalogItem}
                onCreateItem={handleCreateCatalogItem}
              />
            )}

            {/* Campos Personalizados */}
            {activeTab === 'custom_fields' && (
              <CustomFieldsManager
                fields={customFields}
                onCreateField={handleCreateCustomField}
                onToggleActive={handleToggleCustomField}
              />
            )}

            {/* Almacenamiento (Esqueleto Sprint 2) */}
            {activeTab === 'storage' && (
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">Almacenamiento de Archivos</h3>
                  <p className="text-xs text-muted-foreground">
                    Capa StorageProvider y políticas de retención.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                  <p>
                    Almacén Primario: <strong>Supabase Storage (Privado)</strong>
                  </p>
                  <p>
                    Bucket de Logotipos: <strong>logos (Público)</strong>
                  </p>
                  <p>
                    Respaldo a Google Drive: <strong>Desactivado (Fase 5)</strong>
                  </p>
                  <p className="text-muted-foreground pt-2">
                    Todo acceso pasa por URLs firmadas de 60 segundos emitidas por el engine y
                    auditadas.
                  </p>
                </div>
              </div>
            )}

            {/* Avanzado */}
            {activeTab === 'advanced' && (
              <AdvancedSettings
                currentConfig={{
                  catalogs: catalogItems,
                  feature_flags: flags,
                  system_settings: [],
                  custom_fields: customFields,
                }}
                historyItems={history}
                onImportConfig={async (bundle) => {
                  if (bundle.catalogs) setCatalogItems(bundle.catalogs);
                  if (bundle.feature_flags) setFlags(bundle.feature_flags);
                  if (bundle.custom_fields) setCustomFields(bundle.custom_fields);
                }}
                onRestoreDefaults={async (category) => {
                  alert(
                    `Valores de la pestaña '${category}' restaurados a sus valores por defecto.`,
                  );
                }}
              />
            )}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
