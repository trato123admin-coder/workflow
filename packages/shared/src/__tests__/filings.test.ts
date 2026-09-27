import { describe, it, expect } from 'vitest';
import { externalEntitySchema, caseFilingSchema, getFilingUrgency } from '../filings.js';

describe('Trámites Externos y Entidades (filings)', () => {
  describe('Validación de Esquemas', () => {
    it('valida entidad externa con datos completos', () => {
      const entity = {
        entity_type: 'NOTARIA',
        name: 'Notaría Tambini',
        tax_id: '20123456789',
        address: 'Av. Javier Prado Este 1234',
        city: 'Lima',
        phone: '014221122',
        email: 'contacto@notariatambini.pe',
        contacts: [
          {
            name: 'Dr. Roberto Tambini',
            role: 'Notario Titular',
            email: 'rtambini@notariatambini.pe',
            phone: '999888777',
          },
        ],
        is_active: true,
      };

      const result = externalEntitySchema.safeParse(entity);
      expect(result.success).toBe(true);
    });

    it('falla si falta el tipo o nombre de entidad', () => {
      const invalid = {
        tax_id: '20123456789',
      };
      const result = externalEntitySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('valida trámite externo con caso asignado', () => {
      const filing = {
        case_id: 'aaaaaaaa-1111-aaaa-aaaa-aaaaaaaaaaaa',
        filing_kind: 'PUBLICACION_EDICTO',
        status: 'PENDIENTE',
        response_due_date: '2026-10-25',
      };

      const result = caseFilingSchema.safeParse(filing);
      expect(result.success).toBe(true);
    });
  });

  describe('getFilingUrgency', () => {
    it('retorna DONE para categoría semántica DONE o REJECTED', () => {
      expect(
        getFilingUrgency({
          statusCategory: 'DONE',
          response_due_date: '2026-09-01',
        }),
      ).toBe('DONE');

      expect(
        getFilingUrgency({
          statusCategory: 'REJECTED',
          response_due_date: '2026-09-01',
        }),
      ).toBe('DONE');
    });

    it('retorna EXPIRED si la fecha de vencimiento ya pasó y el trámite está pendiente', () => {
      // Simula fecha vencida (fecha base 2026-10-05, venció el 2026-10-01)
      expect(
        getFilingUrgency(
          {
            statusCategory: 'PENDING',
            response_due_date: '2026-10-01',
          },
          [],
          3,
          '2026-10-05',
        ),
      ).toBe('EXPIRED');
    });

    it('retorna EXPIRING_SOON si quedan 3 o menos días hábiles', () => {
      // Fecha base 2026-10-05 (Lunes) y vence el 2026-10-08 (Jueves, 3 días hábiles)
      expect(
        getFilingUrgency(
          {
            statusCategory: 'SUBMITTED',
            response_due_date: '2026-10-08',
          },
          [],
          3,
          '2026-10-05',
        ),
      ).toBe('EXPIRING_SOON');
    });

    it('retorna ON_TRACK si el plazo es holgado o no tiene fecha límite', () => {
      expect(
        getFilingUrgency({
          statusCategory: 'SUBMITTED',
          response_due_date: null,
        }),
      ).toBe('ON_TRACK');
    });
  });
});
