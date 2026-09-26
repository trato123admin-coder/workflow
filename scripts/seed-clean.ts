import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno nativamente en Node 22
try {
  process.loadEnvFile('.env.local');
} catch {
  // Ignorar si no existe
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  process.stderr.write('Error: Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function deleteSyntheticCasesBatch(): Promise<number> {
  let totalDeleted = 0;
  while (true) {
    const { data, error: fErr } = await supabase
      .from('cases')
      .select('id')
      .filter('custom_data->>is_synthetic', 'eq', 'true')
      .limit(250);

    if (fErr) throw new Error(`Error buscando casos sintéticos: ${fErr.message}`);
    if (!data || data.length === 0) break;

    const ids = data.map((d) => d.id);
    const { error: dErr } = await supabase.from('cases').delete().in('id', ids);
    if (dErr) throw new Error(`Error eliminando casos sintéticos: ${dErr.message}`);

    totalDeleted += ids.length;
    process.stdout.write(`  Casos sintéticos eliminados: ${totalDeleted}...\n`);
  }
  return totalDeleted;
}

async function deleteSyntheticPersonsBatch(): Promise<number> {
  let totalDeleted = 0;
  while (true) {
    const { data, error: fErr } = await supabase
      .from('persons')
      .select('id')
      .filter('custom_data->>is_synthetic', 'eq', 'true')
      .limit(250);

    if (fErr) throw new Error(`Error buscando personas sintéticas: ${fErr.message}`);
    if (!data || data.length === 0) break;

    const ids = data.map((d) => d.id);
    const { error: dErr } = await supabase.from('persons').delete().in('id', ids);
    if (dErr) throw new Error(`Error eliminando personas sintéticas: ${dErr.message}`);

    totalDeleted += ids.length;
    process.stdout.write(`  Personas sintéticas eliminadas: ${totalDeleted}...\n`);
  }
  return totalDeleted;
}

async function verifyCleanZero(): Promise<void> {
  const [{ count: remainingCases }, { count: remainingPersons }] = await Promise.all([
    supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .filter('custom_data->>is_synthetic', 'eq', 'true'),
    supabase
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .filter('custom_data->>is_synthetic', 'eq', 'true'),
  ]);

  if ((remainingCases || 0) > 0 || (remainingPersons || 0) > 0) {
    throw new Error(
      `Error de limpieza: Aún quedan ${remainingCases || 0} casos y ${remainingPersons || 0} personas sintéticas.`,
    );
  }
}

export async function cleanSyntheticSeed() {
  process.stdout.write('Iniciando limpieza de datos sintéticos (S4-10)...\n');

  const deletedCases = await deleteSyntheticCasesBatch();
  const deletedPersons = await deleteSyntheticPersonsBatch();
  await verifyCleanZero();

  process.stdout.write('Limpieza de datos sintéticos completada con éxito.\n');
  process.stdout.write(`- Casos eliminados: ${deletedCases}\n`);
  process.stdout.write(`- Personas eliminadas: ${deletedPersons}\n`);
  process.stdout.write(
    '✓ Verificación: 0 casos sintéticos y 0 personas sintéticas restantes en la base de datos.\n',
  );
}

// Ejecutar si se invoca directamente
if (process.argv[1]?.includes('seed-clean')) {
  cleanSyntheticSeed().catch((err) => {
    process.stderr.write(`Error en seed:clean: ${err.message}\n`);
    process.exit(1);
  });
}
