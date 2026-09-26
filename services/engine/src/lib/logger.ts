export interface LogContext {
  [key: string]: unknown;
}

/**
 * Logger estructurado para el motor (Fastify / Node).
 * Escribe JSON estructurado a stdout/stderr cumpliendo la regla de calidad sin console.log.
 */
export const logger = {
  warn(message: string, context?: LogContext): void {
    process.stderr.write(
      JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...context,
      }) + '\n'
    );
  },
  error(message: string, context?: LogContext): void {
    process.stderr.write(
      JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...context,
      }) + '\n'
    );
  },
  info(message: string, context?: LogContext): void {
    process.stdout.write(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...context,
      }) + '\n'
    );
  },
};
