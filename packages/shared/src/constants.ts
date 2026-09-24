export const APP_DEFAULTS = {
  TIMEZONE: 'America/Lima',
  CURRENCY: 'PEN',
  LOCALE: 'es-PE',
} as const;

export type AppDefaults = typeof APP_DEFAULTS;
