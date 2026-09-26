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

export async function runBenchmark() {
  process.stdout.write('============================================================\n');
  process.stdout.write('BENCHMARK DE RENDIMIENTO (S4-10, Criterio: p95 < 2s)\n');
  process.stdout.write('============================================================\n');

  // 1. Buscar expediente de benchmark (10 herederos y 20 bienes)
  const { data: benchCases, error: bErr } = await supabase
    .from('cases')
    .select('id, case_number, title')
    .filter('custom_data->>is_benchmark', 'eq', 'true')
    .limit(1);

  if (bErr || !benchCases || benchCases.length === 0) {
    process.stderr.write(
      'Error: No se encontró el caso de benchmark. Ejecuta pnpm seed:load primero.\n',
    );
    process.exit(1);
  }

  const benchCase = benchCases[0];
  process.stdout.write(`Caso de prueba: [${benchCase.case_number}] ${benchCase.title}\n`);
  process.stdout.write('Ejecutando 20 iteraciones de consulta completa de ficha...\n\n');

  const iterations = 20;
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // Consulta concurrente simulando carga de página de detalle
    await Promise.all([
      supabase.from('cases').select('*, client_person:persons(*)').eq('id', benchCase.id).single(),
      supabase.from('case_parties').select('*, person:persons(*)').eq('case_id', benchCase.id),
      supabase.from('case_assets').select('*').eq('case_id', benchCase.id),
      supabase
        .from('case_processes')
        .select('*, status:workflow_statuses(*)')
        .eq('case_id', benchCase.id),
      supabase.rpc('get_case_semaphore_warnings', { _case_id: benchCase.id }),
    ]);

    const end = performance.now();
    const durationMs = end - start;
    latencies.push(durationMs);
    process.stdout.write(
      `Iteración ${String(i + 1).padStart(2, ' ')}: ${durationMs.toFixed(1)} ms\n`,
    );
  }

  // Cálculos estadísticos
  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const avg = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95Index = Math.ceil(latencies.length * 0.95) - 1;
  const p95 = latencies[p95Index];

  process.stdout.write('\n------------------------------------------------------------\n');
  process.stdout.write('RESULTADOS DEL BENCHMARK:\n');
  process.stdout.write(`- Mínimo: ${min.toFixed(1)} ms\n`);
  process.stdout.write(`- Promedio: ${avg.toFixed(1)} ms\n`);
  process.stdout.write(`- Mediana (p50): ${p50.toFixed(1)} ms\n`);
  process.stdout.write(`- Percentil 95 (p95): ${p95.toFixed(1)} ms\n`);
  process.stdout.write(`- Máximo: ${max.toFixed(1)} ms\n`);
  process.stdout.write('------------------------------------------------------------\n');

  if (p95 < 2000) {
    process.stdout.write(
      `✓ APROBADO: p95 (${p95.toFixed(1)} ms) cumple el objetivo de < 2000 ms (2.0s).\n`,
    );
  } else {
    process.stderr.write(`✗ FALLIDO: p95 (${p95.toFixed(1)} ms) superó el umbral de 2000 ms.\n`);
    process.exit(1);
  }
}

// Ejecutar si se invoca directamente
if (process.argv[1]?.includes('benchmark-perf')) {
  runBenchmark().catch((err) => {
    process.stderr.write(`Error en benchmark: ${err.message}\n`);
    process.exit(1);
  });
}
