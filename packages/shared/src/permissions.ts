/**
 * Catálogo canónico de permisos del sistema (Sprint 1)
 * Fuente: docs/00-maestro.md §3.3 y docs/v2.1 §3.8
 */
export const PERMISSION_CODES = [
  // Clientes y Personas
  'clients.read',
  'clients.write',
  // Casos
  'cases.read.all',
  'cases.read.assigned',
  'cases.create',
  'cases.write.all',
  'cases.write.assigned',
  'cases.close',
  // Procesos
  'processes.update',
  // Documentos
  'documents.read',
  'documents.upload',
  'documents.generate',
  'documents.approve',
  // Plantillas, Reglas y Modelos
  'templates.manage',
  'rules.manage',
  'models.manage',
  // Dominio sucesorio (00-maestro §3.3)
  'parties.read',
  'parties.write',
  'estate.read',
  'estate.write',
  'filings.read',
  'filings.write',
  'entities.read',
  'entities.manage',
  // Cotizaciones
  'quotes.read',
  'quotes.write',
  // Caja Chica
  'cash.read',
  'cash.write',
  'cash.request',
  'cash.approve',
  'cash.close',
  // Reportes
  'reports.read',
  'reports.export',
  // Administración y Auditoría
  'users.manage',
  'roles.manage',
  'settings.manage',
  'audit.read',
  'monitoring.read',
  // IA
  'ai.use',
  'ai.manage',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export interface PermissionDefinition {
  code: PermissionCode;
  module: string;
  description: string;
}

export const MODULE_NAMES: Record<string, string> = {
  clients: 'Personas y Clientes',
  cases: 'Casos y Expedientes',
  processes: 'Procesos y Avance',
  documents: 'Documentos y Expediente Digital',
  templates: 'Plantillas',
  rules: 'Reglas Documentales',
  models: 'Modelos de Caso',
  parties: 'Intervinientes (Sucesorio)',
  estate: 'Patrimonio y Bienes',
  filings: 'Trámites Externos',
  entities: 'Entidades y Notarías',
  quotes: 'Cotizaciones',
  cash: 'Caja Chica',
  reports: 'Reportes y Dashboards',
  admin: 'Administración y Seguridad',
  ai: 'Asistente de IA',
};

export const BASE_ROLES = {
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
  LAWYER: 'LAWYER',
  CONSULT: 'CONSULT',
  CASHIER: 'CASHIER',
} as const;

export type BaseRoleCode = (typeof BASE_ROLES)[keyof typeof BASE_ROLES];
