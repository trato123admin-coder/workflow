import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { isWcagAaCompliant, calculateContrastRatio } from '@workflow/shared';
import { NAV_ITEMS } from '../components/layout/Sidebar';

describe('Settings: WCAG AA Accessibility Contrast', () => {
  it('garantiza contraste AA para tema claro por defecto', () => {
    // Texto primario (#0f172a) sobre tarjeta (#ffffff)
    const check = isWcagAaCompliant('#0f172a', '#ffffff');
    expect(check.compliant).toBe(true);
    expect(check.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('garantiza contraste AA para tema oscuro', () => {
    // Texto (#f8fafc) sobre fondo oscuro (#0f172a)
    const check = isWcagAaCompliant('#f8fafc', '#0f172a');
    expect(check.compliant).toBe(true);
    expect(check.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('rechaza contrastes deficientes que no cumplen con el ratio mínimo', () => {
    // Amarillo claro (#fef08a) sobre blanco (#ffffff)
    const ratio = calculateContrastRatio('#fef08a', '#ffffff');
    expect(ratio).toBeLessThan(3.0);
    const check = isWcagAaCompliant('#fef08a', '#ffffff');
    expect(check.compliant).toBe(false);
  });
});

describe('Settings: Ocultamiento de Módulos por Feature Flag en UI', () => {
  it('Sidebar asocia items sensibles con sus respectivos feature flags', () => {
    const cashItem = NAV_ITEMS.find((item) => item.href === '/cash');
    expect(cashItem?.featureFlag).toBe('module.cash');

    const assistantItem = NAV_ITEMS.find((item) => item.href === '/assistant');
    expect(assistantItem?.featureFlag).toBe('module.ai');

    const reportsItem = NAV_ITEMS.find((item) => item.href === '/reports');
    expect(reportsItem?.featureFlag).toBe('module.reports_export');
  });
});
