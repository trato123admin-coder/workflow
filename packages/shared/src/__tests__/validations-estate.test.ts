import { describe, it, expect } from 'vitest';
import { calculateConsolidatedEstate } from '../validations.js';
import { CreateCaseAssetSchema } from '../case-estate.js';
import type { CaseAssetItem, CaseLiabilityItem } from '../case-estate.js';

describe('Validaciones de Patrimonio y Cuentas Bancarias', () => {
  describe('calculateConsolidatedEstate', () => {
    it('calcula totales por moneda respetando porcentaje de propiedad', () => {
      const assets: CaseAssetItem[] = [
        {
          id: 'a1',
          case_id: 'c1',
          asset_type: 'INMUEBLE',
          description: 'Casa Lima',
          registry_office: 'Lima',
          registry_ref: '12345678',
          ownership_percent: 50,
          estimated_value: 200000,
          currency: 'PEN',
          status: 'IDENTIFICADO',
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'a2',
          case_id: 'c1',
          asset_type: 'CUENTA_BANCARIA',
          description: 'Ahorros USD',
          registry_office: null,
          registry_ref: '4567',
          ownership_percent: 100,
          estimated_value: 10000,
          currency: 'USD',
          status: 'VERIFICADO',
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ];

      const liabilities: CaseLiabilityItem[] = [
        {
          id: 'l1',
          case_id: 'c1',
          liability_type: 'TRIBUTARIA',
          creditor_name: 'SUNAT',
          creditor_person_id: null,
          amount: 5000,
          currency: 'PEN',
          status: 'IDENTIFICADA',
          due_date: null,
          notes: null,
          custom_data: {},
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ];

      const estate = calculateConsolidatedEstate(assets, liabilities);
      // 50% de 200,000 = 100,000 PEN
      expect(estate.totalAssetsPen).toBe(100000);
      expect(estate.totalAssetsUsd).toBe(10000);
      expect(estate.totalLiabilitiesPen).toBe(5000);
      expect(estate.totalLiabilitiesUsd).toBe(0);
      expect(estate.netEstatePen).toBe(95000);
      expect(estate.netEstateUsd).toBe(10000);
    });
  });

  describe('CreateCaseAssetSchema - Validación de cuentas bancarias (M2)', () => {
    it('acepta cuenta bancaria con exactamente 4 dígitos', () => {
      const parsed = CreateCaseAssetSchema.safeParse({
        case_id: '11111111-1111-1111-1111-111111111111',
        asset_type: 'CUENTA_BANCARIA',
        description: 'Cuenta BCP',
        registry_ref: '1234',
        ownership_percent: 100,
        currency: 'PEN',
      });
      expect(parsed.success).toBe(true);
    });

    it('rechaza cuenta bancaria con más de 4 dígitos (regla no negociable)', () => {
      const parsed = CreateCaseAssetSchema.safeParse({
        case_id: '11111111-1111-1111-1111-111111111111',
        asset_type: 'CUENTA_BANCARIA',
        description: 'Cuenta BCP Completa',
        registry_ref: '193-12345678-0-12',
        ownership_percent: 100,
        currency: 'PEN',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors[0]?.message).toContain('solo debe ingresar los últimos 4 dígitos');
      }
    });

    it('permite referencias largas para otros tipos de activos como INMUEBLE', () => {
      const parsed = CreateCaseAssetSchema.safeParse({
        case_id: '11111111-1111-1111-1111-111111111111',
        asset_type: 'INMUEBLE',
        description: 'Departamento Miraflores',
        registry_ref: 'PARTIDA-ELECT-987654321',
        ownership_percent: 100,
        currency: 'PEN',
      });
      expect(parsed.success).toBe(true);
    });
  });
});
