import { describe, it, expect } from 'vitest';
import {
  addBusinessDays,
  getRemainingBusinessDays,
  isBusinessDay,
  toIsoDateString,
  toLimaDateString,
  countBusinessDays,
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
    it('[unitaria] retorna 0 si las fechas coinciden (hoy)', () => {
      expect(getRemainingBusinessDays('2026-10-05', [], '2026-10-05')).toBe(0);
    });

    it('[unitaria] viernes con vencimiento lunes = 1 día hábil restante (fin de semana descontado)', () => {
      // Base: Viernes 2026-10-02, Vencimiento: Lunes 2026-10-05
      expect(getRemainingBusinessDays('2026-10-05', [], '2026-10-02')).toBe(1);
    });

    it('[unitaria] viernes con vencimiento martes y lunes feriado = 1 día hábil restante', () => {
      // Base: Viernes 2026-10-02, Vencimiento: Martes 2026-10-06 con Lunes 2026-10-05 feriado
      expect(getRemainingBusinessDays('2026-10-06', ['2026-10-05'], '2026-10-02')).toBe(1);
    });

    it('[unitaria] retorna positivo para fechas futuras', () => {
      // Del Lunes 2026-10-05 al Lunes 2026-10-12 hay 5 días hábiles
      expect(getRemainingBusinessDays('2026-10-12', [], '2026-10-05')).toBe(5);
    });

    it('[unitaria] retorna negativo para fechas pasadas (trámite vencido)', () => {
      // Del Lunes 2026-10-12 retrocediendo al Lunes 2026-10-05 hay -5 días hábiles
      expect(getRemainingBusinessDays('2026-10-05', [], '2026-10-12')).toBe(-5);
    });

    it('[unitaria] descuenta feriados intermedios en el conteo de días restantes', () => {
      // Con feriado 2026-10-08
      expect(getRemainingBusinessDays('2026-10-12', ['2026-10-08'], '2026-10-05')).toBe(4);
    });
  });

  describe('countBusinessDays & toLimaDateString', () => {
    it('[unitaria] mismo día = 0 días hábiles transcurridos', () => {
      expect(countBusinessDays('2026-10-02', '2026-10-02')).toBe(0);
      expect(countBusinessDays('2026-10-05', '2026-10-05')).toBe(0);
    });

    it('[unitaria] viernes a lunes = 1 día hábil transcurrido (fin de semana descontado)', () => {
      // Viernes 2026-10-02 al Lunes 2026-10-05: 1 día hábil transcurrido
      expect(countBusinessDays('2026-10-02', '2026-10-05')).toBe(1);
      // Simetría absoluta (lunes a viernes en sentido inverso)
      expect(countBusinessDays('2026-10-05', '2026-10-02')).toBe(1);
    });

    it('[unitaria] cruce de fin de semana: viernes a martes = 2 días hábiles', () => {
      // Viernes 2026-10-02 al Martes 2026-10-06: 2 días hábiles (Lun 05 y Mar 06)
      expect(countBusinessDays('2026-10-02', '2026-10-06')).toBe(2);
    });

    it('[unitaria] cruce de fin de semana con feriado: descuenta el feriado hábil', () => {
      // Viernes 2026-10-02 al Martes 2026-10-06 con Lunes 2026-10-05 feriado: 1 día hábil (solo Mar 06)
      expect(countBusinessDays('2026-10-02', '2026-10-06', ['2026-10-05'])).toBe(1);
    });

    it('[unitaria] frontera horaria UTC vs Lima: normaliza a la fecha civil de Lima (UTC-5)', () => {
      // 2026-10-01T04:30:00Z corresponde a 2026-09-30 23:30 en Lima (Miércoles)
      expect(toLimaDateString('2026-10-01T04:30:00Z')).toBe('2026-09-30');

      // 2026-10-01T20:00:00Z corresponde a 2026-10-01 15:00 en Lima (Jueves)
      expect(toLimaDateString('2026-10-01T20:00:00Z')).toBe('2026-10-01');

      // Entre el Miércoles 30-Sep y Jueves 01-Oct hay exactamente 1 día hábil transcurrido
      expect(countBusinessDays('2026-10-01T04:30:00Z', '2026-10-01T20:00:00Z')).toBe(1);
    });
  });
});
