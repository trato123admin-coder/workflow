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

export const SEED_SUMMARY = {
  cases: 5,
  persons: 15,
  parties: 25,
  assets: 28,
  processes: 55,
};

export async function loadSyntheticSeed() {
  process.stdout.write('Iniciando carga de datos sintéticos (S4-10)...\n');

  // 1. Obtener datos de referencia (modelo y estados)
  const { data: modelVer } = await supabase
    .from('case_model_versions')
    .select('id, case_model:case_models(code)')
    .eq('is_published', true)
    .limit(1)
    .single();

  const { data: statuses } = await supabase
    .from('workflow_statuses')
    .select('id, code, category, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const initialStatus = statuses?.find((s) => s.category === 'NOT_STARTED') || statuses?.[0];

  if (!modelVer || !initialStatus) {
    throw new Error('No se encontraron versiones de modelo o estados publicados');
  }

  // 2. Inserción de 15 Personas Sintéticas
  const personsPayload = [
    {
      first_name: 'Carlos',
      last_name: 'Contratante',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: 'SYN90000001',
      email: 'contratante@synthetic.local',
      custom_data: { is_synthetic: true },
    },
    {
      first_name: 'Alberto',
      last_name: 'Causante Benchmark',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: 'SYN90000002',
      is_deceased: true,
      death_date: '2025-01-15',
      custom_data: { is_synthetic: true },
    },
    ...Array.from({ length: 10 }, (_, i) => ({
      first_name: `Heredero ${i + 1}`,
      last_name: 'Benchmark',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: `SYN9000100${i}`,
      birth_date: '1990-05-20',
      custom_data: { is_synthetic: true },
    })),
    {
      first_name: 'Beatriz',
      last_name: 'Causante 2',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: 'SYN90000003',
      is_deceased: true,
      death_date: '2025-02-10',
      custom_data: { is_synthetic: true },
    },
    {
      first_name: 'David',
      last_name: 'Heredero 2A',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: 'SYN90000004',
      birth_date: '1995-08-12',
      custom_data: { is_synthetic: true },
    },
    {
      first_name: 'Elena',
      last_name: 'Heredero 2B',
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: 'SYN90000005',
      birth_date: '1998-11-03',
      custom_data: { is_synthetic: true },
    },
  ];

  const { data: createdPersons, error: pErr } = await supabase
    .from('persons')
    .insert(personsPayload)
    .select('id, identity_document_number');
  if (pErr) throw pErr;

  const personMap = new Map(createdPersons.map((p) => [p.identity_document_number, p.id]));
  const contratanteId = personMap.get('SYN90000001')!;
  const causanteBenchId = personMap.get('SYN90000002')!;

  // 3. Inserción de 5 Casos Sintéticos (1 Benchmark + 4 Estándar)
  const casesPayload = [
    {
      case_number: 'SYN-2026-0001',
      title: 'CASO-BENCHMARK: Sucesión Intestada (10 Herederos / 20 Bienes)',
      client_person_id: contratanteId,
      case_model_version_id: modelVer.id,
      status_id: initialStatus.id,
      route: 'NOTARIAL',
      priority: 'HIGH',
      is_confidential: false,
      current_progress: 15.0,
      custom_data: { is_synthetic: true, is_benchmark: true },
    },
    {
      case_number: 'SYN-2026-0002',
      title: 'CASO-SINTETICO: Sucesión Vía Judicial con Litigio',
      client_person_id: contratanteId,
      case_model_version_id: modelVer.id,
      status_id: initialStatus.id,
      route: 'JUDICIAL',
      priority: 'URGENT',
      is_confidential: true,
      has_dispute: true,
      current_progress: 5.0,
      custom_data: { is_synthetic: true },
    },
    {
      case_number: 'SYN-2026-0003',
      title: 'CASO-SINTETICO: Trámite Sucesorio Notarial Arequipa',
      client_person_id: contratanteId,
      case_model_version_id: modelVer.id,
      status_id: initialStatus.id,
      route: 'NOTARIAL',
      priority: 'NORMAL',
      is_confidential: false,
      current_progress: 45.0,
      custom_data: { is_synthetic: true },
    },
    {
      case_number: 'SYN-2026-0004',
      title: 'CASO-SINTETICO: Sucesión Familia Rodríguez',
      client_person_id: contratanteId,
      case_model_version_id: modelVer.id,
      status_id: initialStatus.id,
      route: 'NOTARIAL',
      priority: 'LOW',
      is_confidential: false,
      current_progress: 80.0,
      custom_data: { is_synthetic: true },
    },
    {
      case_number: 'SYN-2026-0005',
      title: 'CASO-SINTETICO: Trámite Concluido SUNARP',
      client_person_id: contratanteId,
      case_model_version_id: modelVer.id,
      status_id: statuses?.find((s) => s.category === 'DONE')?.id || initialStatus.id,
      route: 'NOTARIAL',
      priority: 'NORMAL',
      is_confidential: false,
      current_progress: 100.0,
      custom_data: { is_synthetic: true },
    },
  ];

  const { data: createdCases, error: cErr } = await supabase
    .from('cases')
    .insert(casesPayload)
    .select('id, case_number');
  if (cErr) throw cErr;

  const benchCase = createdCases.find((c) => c.case_number === 'SYN-2026-0001')!;

  // 4. Intervinientes del Caso Benchmark (1 Causante + 10 Herederos con cuota 10% = 100%)
  const partiesPayload = [
    { case_id: benchCase.id, person_id: causanteBenchId, party_role: 'CAUSANTE', is_active: true },
    ...Array.from({ length: 10 }, (_, i) => ({
      case_id: benchCase.id,
      person_id: personMap.get(`SYN9000100${i}`)!,
      party_role: 'HEREDERO',
      relationship_type: 'HIJO',
      heir_status: 'CONFIRMADO',
      share_percent: 10.0,
      is_active: true,
    })),
  ];

  const { error: partErr } = await supabase.from('case_parties').insert(partiesPayload);
  if (partErr) throw partErr;

  // 5. Inventario de 20 Bienes del Caso Benchmark (10 Inmuebles, 5 Vehículos, 5 Cuentas)
  const assetsPayload = [
    ...Array.from({ length: 10 }, (_, i) => ({
      case_id: benchCase.id,
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
      case_id: benchCase.id,
      asset_type: 'VEHICULO',
      name: `Vehículo Sedán Placa SYN-${200 + i}`,
      status: 'IDENTIFICADO',
      currency: 'USD',
      estimated_value: 12000,
      is_active: true,
      custom_data: { is_synthetic: true },
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      case_id: benchCase.id,
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

  // 6. Procesos para los 5 Casos
  const processNames = [
    'Apertura y contrato', 'Documentos del causante', 'Identificación de herederos',
    'Inventario de bienes y deudas', 'Búsqueda registral', 'Evaluación legal',
    'Solicitud notarial', 'Presentación y publicación', 'Seguimiento notarial',
    'Inscripción SUNARP', 'Cierre y entrega',
  ];

  const allProcesses = createdCases.flatMap((c) =>
    processNames.map((name, seq) => ({
      case_id: c.id,
      sequence: seq + 1,
      name,
      status_id:
        seq === 0
          ? statuses?.find((s) => s.category === 'IN_PROGRESS')?.id || initialStatus.id
          : initialStatus.id,
      weight: 10,
      is_applicable: true,
    })),
  );

  const { error: prcErr } = await supabase.from('case_processes').insert(allProcesses);
  if (prcErr) throw prcErr;

  process.stdout.write('Carga sintética completada con éxito.\n');
  process.stdout.write(`- Casos creados: ${createdCases.length}\n`);
  process.stdout.write(`- Personas creadas: ${createdPersons.length}\n`);
  process.stdout.write(`- Intervinientes vinculados: ${partiesPayload.length}\n`);
  process.stdout.write(`- Bienes inventariados: ${assetsPayload.length}\n`);
  process.stdout.write(`- Procesos generados: ${allProcesses.length}\n`);
  process.stdout.write(`Caso Benchmark ID: ${benchCase.id}\n`);
}

// Ejecutar si se invoca directamente
if (process.argv[1]?.includes('seed-load')) {
  loadSyntheticSeed().catch((err) => {
    process.stderr.write(`Error en seed:load: ${err.message}\n`);
    process.exit(1);
  });
}
