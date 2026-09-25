import { z } from 'zod';

export const CASE_ROUTES = ['NOTARIAL', 'JUDICIAL', 'MIXTA', 'POR_DEFINIR'] as const;
export type CaseRoute = (typeof CASE_ROUTES)[number];

export const CASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const CreateCaseWizardSchema = z.object({
  client_person_id: z.string().uuid('Debe seleccionar un cliente válido'),
  case_model_version_id: z.string().uuid('Debe seleccionar un modelo de caso publicado'),
  title: z.string().min(3, 'El título del caso debe tener al menos 3 caracteres'),
  route: z.enum(CASE_ROUTES).default('POR_DEFINIR'),
  priority: z.enum(CASE_PRIORITIES).default('NORMAL'),
  is_confidential: z.boolean().default(false),
  responsible_id: z.string().uuid('Debe asignar un gestor responsable'),
  lawyer_id: z.string().uuid('Abogado inválido').nullish().or(z.literal('')),
  collaborator_ids: z.array(z.string().uuid()).default([]),
});

export type CreateCaseWizardInput = z.infer<typeof CreateCaseWizardSchema>;

export const UpdateCaseProcessSchema = z.object({
  status_id: z.string().uuid('Estado de workflow inválido'),
  manual_progress: z
    .number()
    .min(0, 'El progreso mínimo es 0%')
    .max(100, 'El progreso máximo es 100%')
    .nullish(),
  notes: z.string().nullish(),
});

export type UpdateCaseProcessInput = z.infer<typeof UpdateCaseProcessSchema>;

export interface CaseItem {
  id: string;
  case_number: string;
  title: string;
  client_person_id: string;
  case_model_version_id: string;
  route: CaseRoute;
  status: string;
  priority: CasePriority;
  is_confidential: boolean;
  has_dispute: boolean;
  ai_allowed: boolean;
  current_progress: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  client_person?: {
    id: string;
    person_type: string;
    identity_document_type: string;
    identity_document_number: string;
    first_name: string | null;
    last_name: string | null;
    legal_name: string | null;
  };
  responsible?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface CaseProcessItem {
  id: string;
  case_id: string;
  case_model_process_id: string;
  process_definition_id: string;
  sequence: number;
  weight: number;
  status_id: string;
  progress: number;
  manual_progress: number | null;
  is_applicable: boolean;
  started_at: string | null;
  completed_at: string | null;
  definition?: {
    code: string;
    name: string;
    description: string | null;
  };
  status?: {
    id: string;
    code: string;
    name: string;
    semantic_category: string;
    color: string | null;
  };
  dependencies?: {
    depends_on_sequence: number;
    depends_on_name: string;
    depends_on_status_name: string;
    is_satisfied: boolean;
  }[];
}
