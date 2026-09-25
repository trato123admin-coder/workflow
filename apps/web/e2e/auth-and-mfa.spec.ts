import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';

test.describe('Sprint 1: Autenticación, MFA y Sistema de Diseño', () => {
  test('Página de Login y Validación de Accesibilidad (Axe)', async ({ page }, testInfo) => {
    await page.goto('/login');

    // 1. Verificar elementos de login
    await expect(page.locator('h2')).toContainText('Iniciar Sesión');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // 2. Validación de campos requeridos
    await page.click('button[type="submit"]');
    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#password-error')).toBeVisible();

    // 3. Análisis de Accesibilidad con Axe (WCAG AA sin errores críticos)
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical',
    );
    expect(criticalViolations).toEqual([]);

    // 4. Captura visual de Login
    const screenshotPath = path.resolve(
      process.cwd(),
      `../../docs/screenshots/login-${testInfo.project.name}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test('Pantalla de Verificación MFA (/mfa/verify)', async ({ page }, testInfo) => {
    await page.goto('/mfa/verify');
    await expect(page.locator('h1')).toContainText('Verificación en Dos Pasos');

    // Captura visual de MFA
    const screenshotPath = path.resolve(
      process.cwd(),
      `../../docs/screenshots/mfa-${testInfo.project.name}.png`,
    );
    await page.screenshot({ path: screenshotPath });
  });

  test('Pantalla de Usuarios y Roles (/users) y AppShell', async ({ page }, testInfo) => {
    await page.goto('/design-system');

    // Comprobar que AppShell y el topbar están visibles
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Sistema de Diseño');

    // Análisis de accesibilidad de componentes
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    const criticals = scan.violations.filter((v) => v.impact === 'critical');
    expect(criticals).toEqual([]);

    // Capturas de pantalla para evidencia de aceptación
    const shellScreenshot = path.resolve(
      process.cwd(),
      `../../docs/screenshots/shell-${testInfo.project.name}.png`,
    );
    await page.screenshot({ path: shellScreenshot, fullPage: true });

    // Navegar a /users
    await page.goto('/users');
    await expect(page.locator('h1')).toContainText('Gestión de Usuarios y Roles');

    const usersScreenshot = path.resolve(
      process.cwd(),
      `../../docs/screenshots/users-${testInfo.project.name}.png`,
    );
    await page.screenshot({ path: usersScreenshot, fullPage: true });
  });
});
