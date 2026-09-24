import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/health/route.js';

describe('Web Health API Route', () => {
  it('returns ok status and default configuration', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.defaults.TIMEZONE).toBe('America/Lima');
    expect(data.defaults.CURRENCY).toBe('PEN');
    expect(data.defaults.LOCALE).toBe('es-PE');
  });
});
