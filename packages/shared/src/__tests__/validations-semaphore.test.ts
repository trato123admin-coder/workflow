import { describe, it, expect } from 'vitest';
import {
  validateMinorRepresentation,
  validateCausanteDeathDate,
  validateCaseSemaphore,
} from '../validations.js';
import type { CasePartyItem } from '../case-parties.js';
import type { PersonItem } from '../persons.js';

function createMockPerson(overrides: Partial<PersonItem> = {}): PersonItem {
  return {
    id: 'p1',
    person_type: 'NATURAL',
    identity_document_type: 'DNI',
    identity_document_number: '12345678',
    first_name: 'Juan',
    last_name: 'Pérez',
    second_last_name: null,
    legal_name: null,
    trade_name: null,
    email: null,
    phone: null,
    address: null,
    birth_date: '1990-01-01',
    marital_status: null,
    is_deceased: false,
    death_date: null,
    death_place: null,
    death_certificate_number: null,
    is_active: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('Validaciones de Representación y Semáforos', () => {
  describe('validateMinorRepresentation', () => {
    it('detecta si un menor de edad no tiene representante', () => {
      const parties: CasePartyItem[] = [
        {
          id: '1',
          case_id: 'c1',
          person_id: 'p1',
          party_role: 'HEREDERO',
          heir_status: 'PRESUNTO',
          share_percent: 50,
          relationship_to_deceased: 'HIJO',
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
          person: createMockPerson({
            identity_document_number: '78901234',
            first_name: 'Niño',
            birth_date: '2016-05-10',
          }),
        },
      ];

      const res = validateMinorRepresentation(parties);
      expect(res.hasUnrepresentedMinors).toBe(true);
      expect(res.unrepresentedMinors.length).toBe(1);
    });

    it('no alerta si el menor tiene un representante asignado', () => {
      const parties: CasePartyItem[] = [
        {
          id: '1',
          case_id: 'c1',
          person_id: 'p1',
          party_role: 'HEREDERO',
          heir_status: 'PRESUNTO',
          share_percent: 50,
          relationship_to_deceased: 'HIJO',
          represented_by: '22222222-2222-2222-2222-222222222222',
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
          person: createMockPerson({
            identity_document_number: '78901234',
            first_name: 'Niño',
            birth_date: '2016-05-10',
          }),
        },
      ];

      const res = validateMinorRepresentation(parties);
      expect(res.hasUnrepresentedMinors).toBe(false);
    });
  });

  describe('validateCausanteDeathDate y Semáforos', () => {
    it('advierte si el causante no tiene fecha de defunción', () => {
      const parties: CasePartyItem[] = [
        {
          id: '1',
          case_id: 'c1',
          person_id: 'p1',
          party_role: 'CAUSANTE',
          heir_status: null,
          share_percent: null,
          relationship_to_deceased: null,
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
          person: createMockPerson({
            birth_date: '1950-01-01',
            death_date: null,
            is_deceased: true,
          }),
        },
      ];

      const res = validateCausanteDeathDate(parties);
      expect(res.hasMissingDeathDate).toBe(true);
    });

    it('consolida múltiples advertencias de semáforo', () => {
      const parties: CasePartyItem[] = [
        {
          id: '1',
          case_id: 'c1',
          person_id: 'p1',
          party_role: 'CAUSANTE',
          heir_status: null,
          share_percent: null,
          relationship_to_deceased: null,
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
          person: createMockPerson({
            birth_date: '1950-01-01',
            death_date: null,
            is_deceased: true,
          }),
        },
        {
          id: '2',
          case_id: 'c1',
          person_id: 'p2',
          party_role: 'HEREDERO',
          heir_status: 'CONFIRMADO',
          share_percent: 50,
          relationship_to_deceased: 'HIJO',
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ];

      const res = validateCaseSemaphore({ route: 'POR_DEFINIR', current_progress: 40 }, parties);
      expect(res.hasWarnings).toBe(true);
      expect(res.warnings.some((w) => w.code === 'CAUSANTE_MISSING_DEATH_DATE')).toBe(true);
      expect(res.warnings.some((w) => w.code === 'HEIR_SHARES_NOT_100')).toBe(true);
      expect(res.warnings.some((w) => w.code === 'ROUTE_UNDEFINED_PAST_EVAL')).toBe(true);
    });
  });
});
