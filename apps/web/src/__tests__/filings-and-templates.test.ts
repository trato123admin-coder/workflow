import { describe, it, expect } from 'vitest';
import { EntityFormSchema } from '../components/entities/EntityModal';
import { FilingFormSchema } from '../components/cases/filings/FilingModal';
import { addBusinessDays, toIsoDateString, getFilingUrgency } from '@workflow/shared';

describe('Sprint 6 Web UI & Form Validations (S6-01 to S6-06)', () => {
  describe('EntityFormSchema (S6-01)', () => {
    it('valida exitosamente una entidad externa con contactos', () => {
      const valid = {
        name: 'Notaría Gómez De La Torre',
        entity_type: 'NOTARIA',
        tax_id: '20100123456',
        city: 'Lima',
        address: 'Av. Pardo 450, Miraflores',
        phone: '014456789',
        email: 'contacto@notariagomez.pe',
        contacts: [
          {
            name: 'Dra. María Elena Gómez',
            role: 'Notaria Titular',
            phone: '998877665',
            email: 'mgomez@notariagomez.pe',
          },
        ],
        is_active: true,
      };

      const res = EntityFormSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('rechaza una entidad sin nombre o sin tipo', () => {
      const invalid = {
        name: '',
        entity_type: '',
        contacts: [],
        is_active: true,
      };

      const res = EntityFormSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        const paths = res.error.errors.map((e) => e.path.join('.'));
        expect(paths).toContain('name');
        expect(paths).toContain('entity_type');
      }
    });

    it('rechaza un contacto con email con formato inválido', () => {
      const invalid = {
        name: 'Banco de Crédito del Perú',
        entity_type: 'BANCO',
        contacts: [
          {
            name: 'Juan Pérez',
            email: 'correo-no-valido',
          },
        ],
        is_active: true,
      };

      const res = EntityFormSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe('FilingFormSchema (S6-02)', () => {
    it('valida un trámite externo con UUID válido de entidad', () => {
      const valid = {
        entity_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        filing_kind: 'Publicación Notarial de Edictos',
        reference_number: 'Kardex 2026-904',
        status: 'PENDIENTE',
        filed_at: '2026-10-01',
        response_due_date: '2026-10-22',
        notes: 'Publicación en El Peruano y diario de mayor circulación',
      };

      const res = FilingFormSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('rechaza trámite si entity_id no es un UUID', () => {
      const invalid = {
        entity_id: 'no-es-uuid',
        filing_kind: 'Inscripción Registral',
        status: 'PENDIENTE',
      };

      const res = FilingFormSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe('Cómputo de Plazos y Urgencias (S6-02, S6-03)', () => {
    it('calcula la fecha límite sumando 15 días útiles desde un lunes', () => {
      // 2026-10-05 es lunes
      const baseDate = '2026-10-05';
      const holidays = ['2026-10-08']; // Combate de Angamos (jueves)
      const computed = addBusinessDays(baseDate, 15, holidays);

      // 15 días útiles saltando fines de semana y el 8 de octubre:
      // Sem 1: mar 6, mie 7, vie 9 (3 d. útiles)
      // Sem 2: lun 12, mar 13, mie 14, jue 15, vie 16 (5 d. útiles -> total 8)
      // Sem 3: lun 19, mar 20, mie 21, jue 22, vie 23 (5 d. útiles -> total 13)
      // Sem 4: lun 26, mar 27 (2 d. útiles -> total 15)
      expect(toIsoDateString(computed)).toBe('2026-10-27');
    });

    it('determina urgencia EXPIRING_SOON si faltan 3 días hábiles o menos', () => {
      const urgency = getFilingUrgency(
        {
          statusCategory: 'SUBMITTED',
          response_due_date: '2026-10-08',
        },
        [],
        3,
        '2026-10-05' // faltan 3 días hábiles
      );

      expect(urgency).toBe('EXPIRING_SOON');
    });

    it('marca urgencia como DONE si el estado semántico es DONE o REJECTED', () => {
      const urgencyDone = getFilingUrgency({
        statusCategory: 'DONE',
        response_due_date: '2025-01-01', // Vencido históricamente pero concluido
      });
      expect(urgencyDone).toBe('DONE');

      const urgencyRejected = getFilingUrgency({
        statusCategory: 'REJECTED',
        response_due_date: '2025-01-01',
      });
      expect(urgencyRejected).toBe('DONE');
    });
  });
});
