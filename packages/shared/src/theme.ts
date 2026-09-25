/**
 * Utilidades para cálculo de contraste accesible WCAG 2.1 AA y temas visuales
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  foreground: string;
}

export const PRESET_THEMES: Record<string, { label: string; colors: ThemeColors }> = {
  light: {
    label: 'Claro',
    colors: {
      primary: '#2563eb',
      secondary: '#f1f5f9',
      background: '#f8fafc',
      card: '#ffffff',
      foreground: '#0f172a',
    },
  },
  dark: {
    label: 'Oscuro',
    colors: {
      primary: '#3b82f6',
      secondary: '#1e293b',
      background: '#0f172a',
      card: '#1e293b',
      foreground: '#f8fafc',
    },
  },
  corporate: {
    label: 'Corporativo',
    colors: {
      primary: '#0f766e',
      secondary: '#f0fdfa',
      background: '#f8fafc',
      card: '#ffffff',
      foreground: '#134e4a',
    },
  },
};

/**
 * Convierte color hex (#RRGGBB o #RGB) a canales RGB [0..255]
 */
export function hexToRgb(hex: string): [number, number, number] {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (cleanHex.length !== 6) {
    return [0, 0, 0];
  }
  const num = parseInt(cleanHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calcula la luminancia relativa según estándar WCAG 2.1
 */
export function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r = 0, g = 0, b = 0] = rgb.map((val) => {
    const srgb = val / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calcula el ratio de contraste entre dos colores HEX (resultado entre 1 y 21)
 */
export function calculateContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(hex1));
  const lum2 = getRelativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}

/**
 * Evalúa cumplimiento de WCAG 2.1 AA
 * - Texto regular: mínimo 4.5:1
 * - Texto grande (>= 18pt o 14pt bold) / componentes UI: mínimo 3.0:1
 */
export function isWcagAaCompliant(
  foregroundHex: string,
  backgroundHex: string,
  isLargeText: boolean = false,
): { compliant: boolean; ratio: number; minRequired: number } {
  const ratio = calculateContrastRatio(foregroundHex, backgroundHex);
  const minRequired = isLargeText ? 3.0 : 4.5;
  return {
    compliant: ratio >= minRequired,
    ratio,
    minRequired,
  };
}
