import { createClient } from '@supabase/supabase-js';
import { cleanSyntheticSeed } from './seed-clean.js';

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

export const SEED_SUMMARY = {
  cases: 10000,
  persons: 100,
  parties: 20009,
  assets: 20,
  processes: 110000,
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function loadSyntheticSeed() {
  process.stdout.write('Iniciando carga de escala real: 10 000 casos sintéticos (S4-10)...\n');

  // a) Idempotencia: Limpiar datos sintéticos previos para partir de estado conocido
  await cleanSyntheticSeed();

  // 1. Obtener datos de referencia
  const { data: modelVer } = await supabase
    .from('case_model_versions')
    .select('id')
    .eq('is_published', true)
    .limit(1)
    .single();

  const { data: statuses } = await supabase
    .from('workflow_statuses')
    .select('id, code, category, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const initialStatus = statuses?.find((s) => s.category === 'NOT_STARTED') || statuses?.[0];
  const inProgressStatus = statuses?.find((s) => s.category === 'IN_PROGRESS') || initialStatus;

  if (!modelVer || !initialStatus) throw new Error('Modelo o estados no encontrados');

  // b) Generación correlativa oficial vía case_counters (mismo algoritmo que private.next_case_number)
  const vYear = new Date().getFullYear();
  const { data: counterRow } = await supabase
    .from('case_counters')
    .select('last_value')
    .eq('year', vYear)
    .maybeSingle();

  const startCounter = counterRow?.last_value || 0;
  const newLastValue = startCounter + 10000;
  await supabase.from('case_counters').upsert({ year: vYear, last_value: newLastValue });
  process.stdout.write(`Contador oficial reservado: ${startCounter + 1} al ${newLastValue}\n`);

  // 2. Inserción de 100 personas (12 de benchmark + 88 para rotación en casos de volumen)
  const personsPayload = [
    { first_name: 'Carlos', last_name: 'Contratante Bench', person_type: 'NATURAL', identity_document_type: 'DNI', identity_document_number: 'SYN90000001', custom_data: { is_synthetic: true } },
    { first_name: 'Alberto', last_name: 'Causante Bench', person_type: 'NATURAL', identity_document_type: 'DNI', identity_document_number: 'SYN90000002', is_deceased: true, death_date: '2025-01-15', custom_data: { is_synthetic: true } },
    ...Array.from({ length: 10 }, (_, i) => ({
      first_name: `Heredero ${i + 1}`,
      last_name: 'Benchmark',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: `SYN900010${String(i).padStart(2, '0')}`,
      birth_date: '1990-05-20',
      custom_data: { is_synthetic: true },
    })),
    ...Array.from({ length: 88 }, (_, i) => ({
      first_name: `Persona Sintética ${i + 1}`,
      last_name: 'Volumen',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: `SYN900020${String(i).padStart(2, '0')}`,
      birth_date: '1985-03-15',
      custom_data: { is_synthetic: true },
    })),
  ];

  const { data: createdPersons, error: pErr } = await supabase
    .from('persons')
    .insert(personsPayload)
    .select('id');
  if (pErr || !createdPersons) throw pErr;
  process.stdout.write(`✓ Personas creadas: ${createdPersons.length}\n`);

  const benchClientId = createdPersons[0].id;
  const benchCausanteId = createdPersons[1].id;
  const benchHeirIds = createdPersons.slice(2, 12).map((p) => p.id);
  const volumePool = createdPersons.slice(12).map((p) => p.id);

  // 3. Generación de 10 000 Casos (Caso 0 = Benchmark, Casos 1..9999 = Volumen)
  process.stdout.write('Generando 10 000 expedientes en lotes de 500...\n');
  const allCasesPayload = Array.from({ length: 10000 }, (_, i) => {
    const caseNum = `${vYear}-${String(startCounter + i + 1).padStart(6, '0')}`;
    const isBench = i === 0;
    const clientId = isBench ? benchClientId : volumePool[i % volumePool.length];
    return {
      case_number: caseNum,
      title: isBench
        ? 'CASO-BENCHMARK: Sucesión Intestada (10 Herederos / 20 Bienes)'
        : `Expediente Sucesorio de Volumen ${caseNum}`,
      client_person_id: clientId,
      case_model_version_id: modelVer.id,
      status_id: initialStatus.id,
      route: 'NOTARIAL',
      priority: isBench ? 'HIGH' : 'NORMAL',
      is_confidential: false,
      current_progress: isBench ? 25.0 : 0.0,
      custom_data: { is_synthetic: true, is_benchmark: isBench },
    };
  });

  const createdCaseIds: { id: string; isBench: boolean }[] = [];
  const caseBatches = chunkArray(allCasesPayload, 500);
  for (let b = 0; b < caseBatches.length; b++) {
    const { data, error } = await supabase
      .from('cases')
      .insert(caseBatches[b])
      .select('id, custom_data');
    if (error || !data) throw error;
    for (const r of data) {
      createdCaseIds.push({ id: r.id, isBench: !!r.custom_data?.is_benchmark });
    }
    process.stdout.write(`  Lote casos ${b + 1}/${caseBatches.length} insertado (${createdCaseIds.length}/10000)\n`);
  }

  const benchCaseId = createdCaseIds.find((c) => c.isBench)!.id;

  // 4. Intervinientes: 11 en Benchmark + 2 en cada caso de volumen (1 causante + 1 heredero) = 20 009
  process.stdout.write('Generando intervinientes en lotes de 1000...\n');
  const partiesPayload = [
    { case_id: benchCaseId, person_id: benchCausanteId, party_role: 'CAUSANTE', is_active: true },
    ...benchHeirIds.map((hId) => ({
      case_id: benchCaseId,
      person_id: hId,
      party_role: 'HEREDERO',
      relationship_type: 'HIJO',
      heir_status: 'CONFIRMADO',
      share_percent: 10.0,
      is_active: true,
    })),
  ];

  for (let i = 1; i < createdCaseIds.length; i++) {
    const cId = createdCaseIds[i].id;
    const causanteId = volumePool[(i * 2) % volumePool.length];
    const heirId = volumePool[(i * 2 + 1) % volumePool.length];
    partiesPayload.push(
      { case_id: cId, person_id: causanteId, party_role: 'CAUSANTE', is_active: true },
      {
        case_id: cId,
        person_id: heirId,
        party_role: 'HEREDERO',
        relationship_type: 'HIJO',
        heir_status: 'CONFIRMADO',
        share_percent: 100.0,
        is_active: true,
      }
    );
  }

  const partyBatches = chunkArray(partiesPayload, 1000);
  for (let b = 0; b < partyBatches.length; b++) {
    const { error } = await supabase.from('case_parties').insert(partyBatches[b]);
    if (error) throw error;
  }
  process.stdout.write(`✓ Intervinientes insertados: ${partiesPayload.length}\n`);

  // 5. Inventario de 20 Bienes del Caso Benchmark
  const assetsPayload = [
    ...Array.from({ length: 10 }, (_, i) => ({
      case_id: benchCaseId,
      asset_type: 'INMUEBLE',
      name: `Inmueble Urbano Lote ${i + 1}`,
      registry_number: `PARTIDA-REG-${1000 + i}`,
      status: 'IDENTIFICADO',
      currency: 'PEN',
      estimated_value: 250000,
      is_active: true,
      custom_data: { is_synthetic: true },
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      case_id: benchCaseId,
      asset_type: 'VEHICULO',
      name: `Vehículo Sedán Placa SYN-${200 + i}`,
      status: 'IDENTIFICADO',
      currency: 'USD',
      estimated_value: 12000,
      is_active: true,
      custom_data: { is_synthetic: true },
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      case_id: benchCaseId,
      asset_type: 'CUENTA_BANCARIA',
      name: `Cuenta de Ahorros BCP *${1000 + i}`,
      status: 'IDENTIFICADO',
      currency: 'PEN',
      estimated_value: 15000,
      is_active: true,
      custom_data: { is_synthetic: true },
    })),
  ];
  const { error: astErr } = await supabase.from('case_assets').insert(assetsPayload);
  if (astErr) throw astErr;
  process.stdout.write(`✓ Bienes de benchmark insertados: ${assetsPayload.length}\n`);

  // 6. Procesos Sucesorios (11 procesos × 10 000 casos = 110 000 filas en lotes de 2000)
  process.stdout.write('Generando 110 000 procesos en lotes de 2000...\n');
  const processNames = [
    'Apertura y contrato', 'Documentos del causante', 'Identificación de herederos',
    'Inventario de bienes y deudas', 'Búsqueda registral', 'Evaluación legal',
    'Solicitud notarial', 'Presentación y publicación', 'Seguimiento notarial',
    'Inscripción SUNARP', 'Cierre y entrega',
  ];

  const allProcesses = createdCaseIds.flatMap((c) =>
    processNames.map((name, seq) => ({
      case_id: c.id,
      sequence: seq + 1,
      name,
      status_id: seq === 0 ? inProgressStatus.id : initialStatus.id,
      weight: 10,
      is_applicable: true,
    }))
  );

  const procBatches = chunkArray(allProcesses, 2000);
  for (let b = 0; b < procBatches.length; b++) {
    const { error } = await supabase.from('case_processes').insert(procBatches[b]);
    if (error) throw error;
    if ((b + 1) % 10 === 0 || b === procBatches.length - 1) {
      process.stdout.write(`  Procesos lote ${b + 1}/${procBatches.length} insertado (${(b + 1) * 2000 > 110000 ? 110000 : (b + 1) * 2000}/110000)\n`);
    }
  }

  process.stdout.write('\n============================================================\n');
  process.stdout.write('CARGA SINTÉTICA DE ESCALA REAL COMPLETADA (S4-10)\n');
  process.stdout.write(`- Total casos en base: 10 000 (1 benchmark + 9 999 volumen)\n`);
  process.stdout.write(`- Total personas: 100\n`);
  process.stdout.write(`- Total intervinientes: 20 009\n`);
  process.stdout.write(`- Total bienes: 20 (concentrados en caso benchmark)\n`);
  process.stdout.write(`- Total procesos: 110 000 (11 por expediente)\n`);
  process.stdout.write(`- Benchmark Case ID: ${benchCaseId}\n`);
  process.stdout.write('============================================================\n');
}

if (process.argv[1]?.includes('seed-load')) {
  loadSyntheticSeed().catch((err) => {
    process.stderr.write(`Error en seed:load: ${err.message}\n`);
    process.exit(1);
  });
}
