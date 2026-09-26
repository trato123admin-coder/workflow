import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno nativamente en Node 22
try {
  process.loadEnvFile('.env.local');
} catch {
  // Ignorar si no existe
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  process.stderr.write('Error: Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function cleanSyntheticSeed() {
  process.stdout.write('Iniciando limpieza de datos sintéticos (S4-10)...\n');

  // 1. Eliminar expedientes sintéticos (sus dependencias se eliminan en cascada)
  const { data: deletedCases, error: cErr } = await supabase
    .from('cases')
    .delete()
    .filter('custom_data->>is_synthetic', 'eq', 'true')
    .select('id');

  if (cErr) {
    throw new Error(`Error eliminando casos sintéticos: ${cErr.message}`);
  }

  // 2. Eliminar personas sintéticas
  const { data: deletedPersons, error: pErr } = await supabase
    .from('persons')
    .delete()
    .filter('custom_data->>is_synthetic', 'eq', 'true')
    .select('id');

  if (pErr) {
    throw new Error(`Error eliminando personas sintéticas: ${pErr.message}`);
  }

  // 3. Confirmación y verificación de estado limpio (cero registros sintéticos restantes)
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
      `Error de limpieza: Aún quedan ${remainingCases || 0} casos y ${remainingPersons || 0} personas sintéticas.`
    );
  }

  process.stdout.write('Limpieza de datos sintéticos completada con éxito.\n');
  process.stdout.write(`- Casos eliminados: ${deletedCases?.length || 0}\n`);
  process.stdout.write(`- Personas eliminadas: ${deletedPersons?.length || 0}\n`);
  process.stdout.write('✓ Verificación: 0 casos sintéticos y 0 personas sintéticas restantes en la base de datos.\n');
}

// Ejecutar si se invoca directamente
if (process.argv[1]?.includes('seed-clean')) {
  cleanSyntheticSeed().catch((err) => {
    process.stderr.write(`Error en seed:clean: ${err.message}\n`);
    process.exit(1);
  });
}
