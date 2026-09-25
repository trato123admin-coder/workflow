import { describe, it, expect } from 'vitest';
import { CreateCaseWizardSchema, UpdateCaseProcessSchema } from '../cases.js';

describe('CreateCaseWizardSchema', () => {
  it('validates a complete valid case wizard input', () => {
    const input = {
      client_person_id: 'a0000000-0000-0000-0000-000000000001',
      case_model_version_id: 'b0000000-0000-0000-0000-000000000001',
      title: 'Sucesión Intestada - Juan Pérez',
      route: 'NOTARIAL',
      priority: 'NORMAL',
      is_confidential: false,
      responsible_id: 'c0000000-0000-0000-0000-000000000001',
      lawyer_id: 'd0000000-0000-0000-0000-000000000001',
      collaborator_ids: [],
    };
    const result = CreateCaseWizardSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails if client_person_id is not a valid uuid', () => {
    const input = {
      client_person_id: 'not-a-uuid',
      case_model_version_id: 'b0000000-0000-0000-0000-000000000001',
      title: 'Sucesión Intestada',
      responsible_id: 'c0000000-0000-0000-0000-000000000001',
    };
    const result = CreateCaseWizardSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails if title is too short', () => {
    const input = {
      client_person_id: 'a0000000-0000-0000-0000-000000000001',
      case_model_version_id: 'b0000000-0000-0000-0000-000000000001',
      title: 'ab',
      responsible_id: 'c0000000-0000-0000-0000-000000000001',
    };
    const result = CreateCaseWizardSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('UpdateCaseProcessSchema', () => {
  it('validates a valid status and progress update', () => {
    const input = {
      status_id: 'e0000000-0000-0000-0000-000000000001',
      manual_progress: 100,
      notes: 'Finalizado conforme',
    };
    const result = UpdateCaseProcessSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects progress outside 0-100', () => {
    const input = {
      status_id: 'e0000000-0000-0000-0000-000000000001',
      manual_progress: 105,
    };
    const result = UpdateCaseProcessSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
