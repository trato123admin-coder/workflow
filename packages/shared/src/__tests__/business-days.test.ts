import { describe, it, expect } from 'vitest';
import {
  addBusinessDays,
  getRemainingBusinessDays,
  isBusinessDay,
  toIsoDateString,
} from '../business-days.js';

describe('Cálculo de Días Hábiles (business-days)', () => {
  it('toIsoDateString normaliza fechas a formato YYYY-MM-DD', () => {
    expect(toIsoDateString('2026-10-05')).toBe('2026-10-05');
    expect(toIsoDateString('2026-10-05T15:30:00Z')).toBe('2026-10-05');
    const d = new Date(Date.UTC(2026, 9, 5));
    expect(toIsoDateString(d)).toBe('2026-10-05');
  });

  describe('isBusinessDay', () => {
    it('reconoce días de semana como laborables', () => {
      // 2026-10-05 es Lunes
      expect(isBusinessDay('2026-10-05')).toBe(true);
      // 2026-10-09 es Viernes
      expect(isBusinessDay('2026-10-09')).toBe(true);
    });

    it('excluye fines de semana', () => {
      // 2026-10-10 es Sábado
      expect(isBusinessDay('2026-10-10')).toBe(false);
      // 2026-10-11 es Domingo
      expect(isBusinessDay('2026-10-11')).toBe(false);
    });

    it('excluye feriados activos si caen en día de semana', () => {
      // 2026-10-08 es Jueves (Combate de Angamos en Perú)
      expect(isBusinessDay('2026-10-08', ['2026-10-08'])).toBe(false);
    });

    it('maneja feriado que cae en fin de semana sin duplicar exclusión', () => {
      // Sábado festivo sigue siendo no hábil
      expect(isBusinessDay('2026-10-10', ['2026-10-10'])).toBe(false);
    });
  });

  describe('addBusinessDays', () => {
    it('maneja tabla de feriados vacía sin fallar (omite únicamente fines de semana)', () => {
      // Lunes 2026-10-05 + 5 días hábiles = Lunes 2026-10-12
      const result = addBusinessDays('2026-10-05', 5, []);
      expect(result).toBe('2026-10-12');
    });

    it('cruza el fin de semana correctamente (Viernes + 1 día hábil = Lunes)', () => {
      // Viernes 2026-10-09 + 1 día hábil = Lunes 2026-10-12
      const result = addBusinessDays('2026-10-09', 1);
      expect(result).toBe('2026-10-12');
    });

    it('descuenta feriados en días hábiles', () => {
      // Lunes 2026-10-05 + 4 días hábiles con Jueves 2026-10-08 como feriado
      // Días sumados: Mar 06 (1), Mié 07 (2), Jue 08 (feriado), Vie 09 (3), Lun 12 (4)
      const result = addBusinessDays('2026-10-05', 4, ['2026-10-08']);
      expect(result).toBe('2026-10-12');
    });

    it('cruza cambio de mes correctamente', () => {
      // Viernes 2026-10-30 + 1 día hábil = Lunes 2026-11-02
      // Si el 2026-11-01 fuera feriado (domingo), no altera el lunes
      const result = addBusinessDays('2026-10-30', 1);
      expect(result).toBe('2026-11-02');
    });

    it('cruza cambio de año correctamente', () => {
      // Jueves 2026-12-31 + 1 día hábil con Viernes 2027-01-01 como feriado
      // Día siguiente hábil es Lunes 2027-01-04
      const result = addBusinessDays('2026-12-31', 1, ['2027-01-01']);
      expect(result).toBe('2027-01-04');
    });

    it('retorna la fecha original si days <= 0', () => {
      expect(addBusinessDays('2026-10-05', 0)).toBe('2026-10-05');
      expect(addBusinessDays('2026-10-05', -3)).toBe('2026-10-05');
    });
  });

  describe('getRemainingBusinessDays', () => {
    it('retorna 0 si las fechas coinciden', () => {
      expect(getRemainingBusinessDays('2026-10-05', [], '2026-10-05')).toBe(0);
    });

    it('retorna positivo para fechas futuras', () => {
      // Del Lunes 2026-10-05 al Lunes 2026-10-12 hay 5 días hábiles
      expect(getRemainingBusinessDays('2026-10-12', [], '2026-10-05')).toBe(5);
    });

    it('retorna negativo para fechas pasadas (trámite vencido)', () => {
      // Del Lunes 2026-10-12 retrocediendo al Lunes 2026-10-05 hay -5 días hábiles
      expect(getRemainingBusinessDays('2026-10-05', [], '2026-10-12')).toBe(-5);
    });

    it('descuenta feriados intermedios en el conteo de días restantes', () => {
      // Con feriado 2026-10-08
      expect(getRemainingBusinessDays('2026-10-12', ['2026-10-08'], '2026-10-05')).toBe(4);
    });
  });
});
