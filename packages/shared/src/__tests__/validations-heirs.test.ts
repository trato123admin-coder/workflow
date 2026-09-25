import { describe, it, expect } from 'vitest';
import { calculateAge, isMinor, validateHeirQuotas } from '../validations.js';
import type { CasePartyItem } from '../case-parties.js';

describe('Validaciones de Cuotas Hereditarias y Minoría de Edad', () => {
  describe('calculateAge e isMinor', () => {
    it('calcula la edad correctamente en base a fecha de referencia', () => {
      const ref = new Date('2026-09-25');
      expect(calculateAge('2008-09-24', ref)).toBe(18);
      expect(calculateAge('2008-09-26', ref)).toBe(17);
      expect(calculateAge('2016-01-01', ref)).toBe(10);
    });

    it('determina si una persona es menor de 18 años', () => {
      const ref = new Date('2026-09-25');
      expect(isMinor('2008-09-26', ref)).toBe(true);
      expect(isMinor('2008-09-25', ref)).toBe(false);
      expect(isMinor(null, ref)).toBe(false);
    });
  });

  describe('validateHeirQuotas', () => {
    it('es válido si las cuotas confirmadas suman exactamente 100%', () => {
      const parties: CasePartyItem[] = [
        {
          id: '1',
          case_id: 'c1',
          person_id: 'p1',
          party_role: 'HEREDERO',
          heir_status: 'CONFIRMADO',
          share_percent: 60,
          relationship_to_deceased: 'HIJO',
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
        {
          id: '2',
          case_id: 'c1',
          person_id: 'p2',
          party_role: 'HEREDERO',
          heir_status: 'CONFIRMADO',
          share_percent: 40,
          relationship_to_deceased: 'HIJO',
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ];

      const res = validateHeirQuotas(parties);
      expect(res.isValid).toBe(true);
      expect(res.totalPercent).toBe(100);
      expect(res.diff).toBe(0);
    });

    it('es inválido si las cuotas confirmadas suman menos o más de 100%', () => {
      const parties: CasePartyItem[] = [
        {
          id: '1',
          case_id: 'c1',
          person_id: 'p1',
          party_role: 'HEREDERO',
          heir_status: 'CONFIRMADO',
          share_percent: 65,
          relationship_to_deceased: 'HIJO',
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ];

      const res = validateHeirQuotas(parties);
      expect(res.isValid).toBe(false);
      expect(res.totalPercent).toBe(65);
      expect(res.diff).toBe(35);
    });

    it('ignora herederos no confirmados o inactivos en el cálculo', () => {
      const parties: CasePartyItem[] = [
        {
          id: '1',
          case_id: 'c1',
          person_id: 'p1',
          party_role: 'HEREDERO',
          heir_status: 'CONFIRMADO',
          share_percent: 100,
          relationship_to_deceased: 'HIJO',
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
        {
          id: '2',
          case_id: 'c1',
          person_id: 'p2',
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
        },
        {
          id: '3',
          case_id: 'c1',
          person_id: 'p3',
          party_role: 'HEREDERO',
          heir_status: 'CONFIRMADO',
          share_percent: 50,
          relationship_to_deceased: 'HIJO',
          represented_by: null,
          notes: null,
          custom_data: {},
          is_active: false,
          created_at: '',
          updated_at: '',
        },
      ];

      const res = validateHeirQuotas(parties);
      expect(res.isValid).toBe(true);
      expect(res.totalPercent).toBe(100);
    });
  });
});
