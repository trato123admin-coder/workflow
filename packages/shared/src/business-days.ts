/**
 * Funciones de cálculo de días hábiles y plazos en días útiles.
 * Excluye sábados, domingos y los feriados registrados en la tabla holidays.
 */

/**
 * Normaliza una fecha (Date o string YYYY-MM-DD) a formato 'YYYY-MM-DD'.
 */
export function toIsoDateString(date: Date | string): string {
  if (typeof date === 'string') {
    // Si ya viene como YYYY-MM-DD o ISO string
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    date = new Date(date);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Crea un objeto Date fijado en UTC a partir de un string 'YYYY-MM-DD' o Date.
 */
function parseUtcDate(date: Date | string): Date {
  const iso = toIsoDateString(date);
  const parts = iso.split('-');
  const year = Number(parts[0] ?? 1970);
  const month = Number(parts[1] ?? 1);
  const day = Number(parts[2] ?? 1);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Normaliza una lista de feriados a un conjunto Set de strings 'YYYY-MM-DD'.
 */
function buildHolidaySet(holidays: (string | Date)[] = []): Set<string> {
  const set = new Set<string>();
  for (const h of holidays) {
    if (h) {
      set.add(toIsoDateString(h));
    }
  }
  return set;
}

/**
 * Determina si una fecha dada es un día hábil (lunes a viernes y no feriado).
 */
export function isBusinessDay(date: Date | string, holidays: (string | Date)[] = []): boolean {
  const utcDate = parseUtcDate(date);
  const dayOfWeek = utcDate.getUTCDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  const holidaySet = buildHolidaySet(holidays);
  return !holidaySet.has(toIsoDateString(date));
}

/**
 * Suma N días hábiles a partir de una fecha base.
 * Tolera tabla de feriados vacía: simplemente excluye sábados y domingos.
 *
 * @param fromDate Fecha de inicio (Date o 'YYYY-MM-DD')
 * @param days Cantidad de días hábiles a sumar (debe ser > 0)
 * @param holidays Lista opcional de fechas feriadas (Date o 'YYYY-MM-DD')
 * @returns Fecha resultante en formato 'YYYY-MM-DD'
 */
export function addBusinessDays(
  fromDate: Date | string,
  days: number,
  holidays: (string | Date)[] = []
): string {
  if (!fromDate) return '';
  const current = parseUtcDate(fromDate);
  if (days <= 0) {
    return toIsoDateString(current);
  }

  const holidaySet = buildHolidaySet(holidays);
  let added = 0;

  while (added < days) {
    current.setUTCDate(current.getUTCDate() + 1);
    const dayOfWeek = current.getUTCDay();
    // Lunes a Viernes
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const isoStr = toIsoDateString(current);
      if (!holidaySet.has(isoStr)) {
        added++;
      }
    }
  }

  return toIsoDateString(current);
}

/**
 * Calcula los días hábiles restantes entre dos fechas.
 * Retorna positivo si targetDate está en el futuro, negativo si está vencido, 0 si es hoy.
 *
 * @param targetDate Fecha objetivo o de vencimiento
 * @param holidays Lista de feriados
 * @param fromDate Fecha base (por defecto hoy en UTC)
 */
export function getRemainingBusinessDays(
  targetDate: Date | string,
  holidays: (string | Date)[] = [],
  fromDate?: Date | string
): number {
  if (!targetDate) return 0;
  const start = parseUtcDate(fromDate ?? new Date());
  const end = parseUtcDate(targetDate);
  const startIso = toIsoDateString(start);
  const endIso = toIsoDateString(end);

  if (startIso === endIso) {
    return 0;
  }

  const holidaySet = buildHolidaySet(holidays);
  const isFuture = end > start;
  const step = isFuture ? 1 : -1;
  let count = 0;

  const cur = new Date(start.getTime());
  while (toIsoDateString(cur) !== endIso) {
    cur.setUTCDate(cur.getUTCDate() + step);
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5 && !holidaySet.has(toIsoDateString(cur))) {
      count++;
    }
  }

  return isFuture ? count : -count;
}
