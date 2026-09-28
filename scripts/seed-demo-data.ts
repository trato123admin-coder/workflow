import { createClient } from '@supabase/supabase-js';

try {
  process.loadEnvFile('.env.local');
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function seedDemoData() {
  console.log('Iniciando carga de datos demo para Dashboard y Caja Chica...');

  // 1. Obtener perfiles existentes
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email, first_name, last_name');
  if (profErr || !profiles || profiles.length === 0) {
    throw new Error('No se encontraron perfiles en la base de datos');
  }

  const adminUser = profiles.find((p) => p.email.includes('admin') || p.email.includes('trato123')) || profiles[0];
  const gestor1 = profiles.find((p) => p.email.includes('gestor1')) || profiles[1] || adminUser;
  const gestor2 = profiles.find((p) => p.email.includes('gestor2')) || profiles[2] || adminUser;
  const abogado = profiles.find((p) => p.email.includes('agencia') || p.email.includes('carlos')) || profiles[3] || adminUser;

  console.log(`Perfiles asignados:
  - Admin: ${adminUser.email} (${adminUser.id})
  - Gestor 1: ${gestor1.email} (${gestor1.id})
  - Gestor 2: ${gestor2.email} (${gestor2.id})
  - Abogado: ${abogado.email} (${abogado.id})`);

  // 2. Obtener estados de workflow
  const { data: statuses } = await supabase.from('workflow_statuses').select('*').order('sort_order', { ascending: true });
  const inProgressStatus = statuses?.find((s) => s.category === 'IN_PROGRESS') || statuses?.[1];
  const doneStatus = statuses?.find((s) => s.category === 'DONE') || statuses?.[statuses.length - 1];
  const waitingStatus = statuses?.find((s) => s.category === 'WAITING') || inProgressStatus;

  // 3. Enriquecer los casos existentes
  const { data: existingCases } = await supabase.from('cases').select('id, case_number').order('case_number', { ascending: true });
  console.log(`Casos existentes a actualizar: ${existingCases?.length || 0}`);

  if (existingCases && existingCases.length >= 5) {
    // Caso 1: En trámite, 65% de avance
    await supabase.from('cases').update({
      status: 'IN_PROGRESS',
      due_date: '2026-10-15',
    }).eq('id', existingCases[0].id);

    // Caso 2: Vencido (alerta en dashboard y ¿Qué hago hoy?), 35% de avance
    await supabase.from('cases').update({
      status: 'OPEN',
      due_date: '2026-09-20', // Vencido hace 8 días
      priority: 'URGENT',
    }).eq('id', existingCases[1].id);

    // Caso 3: Finalizado (100% de avance, COMPLETED)
    await supabase.from('cases').update({
      status: 'COMPLETED',
      due_date: '2026-09-10',
      closed_at: '2026-09-24T18:00:00Z',
    }).eq('id', existingCases[2].id);

    // Caso 4: En espera / Pausado, sin abogado asignado (para probar KPI sin abogado y estado WAITING)
    await supabase.from('cases').update({
      status: 'ON_HOLD',
      due_date: '2026-10-01',
    }).eq('id', existingCases[3].id);

    // Caso 5: Vencido crítico, 15% de avance
    await supabase.from('cases').update({
      current_progress: 15.0,
      status: 'OPEN',
      due_date: '2026-09-25', // Vencido hace 3 días
      priority: 'HIGH',
    }).eq('id', existingCases[4].id);
    console.log('✓ Casos actualizados con progreso, estados y fechas SLA');

    // 4. Asignaciones de casos para la carga de trabajo por analista
    // Limpiar asignaciones previas de estos 5 casos
    await supabase.from('case_assignments').delete().in('case_id', existingCases.map((c) => c.id));

    await supabase.from('case_assignments').insert([
      // Caso 1: Responsable Gestor 1, Abogado
      { case_id: existingCases[0].id, user_id: gestor1.id, assignment_type: 'RESPONSIBLE', is_primary: true },
      { case_id: existingCases[0].id, user_id: abogado.id, assignment_type: 'LAWYER', is_primary: false },

      // Caso 2: Responsable Gestor 2, Abogado
      { case_id: existingCases[1].id, user_id: gestor2.id, assignment_type: 'RESPONSIBLE', is_primary: true },
      { case_id: existingCases[1].id, user_id: abogado.id, assignment_type: 'LAWYER', is_primary: false },

      // Caso 3: Responsable Admin (Completado)
      { case_id: existingCases[2].id, user_id: adminUser.id, assignment_type: 'RESPONSIBLE', is_primary: true },
      { case_id: existingCases[2].id, user_id: abogado.id, assignment_type: 'LAWYER', is_primary: false },

      // Caso 4: Responsable Gestor 1 (SIN ABOGADO para KPI "Sin Abogado")
      { case_id: existingCases[3].id, user_id: gestor1.id, assignment_type: 'RESPONSIBLE', is_primary: true },

      // Caso 5: Responsable Gestor 2, Abogado
      { case_id: existingCases[4].id, user_id: gestor2.id, assignment_type: 'RESPONSIBLE', is_primary: true },
      { case_id: existingCases[4].id, user_id: abogado.id, assignment_type: 'LAWYER', is_primary: false },
    ]);
    console.log('✓ Asignaciones de analistas creadas');

    // 5. Actualizar estados de case_processes para el embudo (Process Funnel)
    const { data: procs } = await supabase.from('case_processes').select('id, case_id, sequence').in('case_id', existingCases.map((c) => c.id));
    if (procs) {
      for (const pr of procs) {
        let stId = inProgressStatus.id;
        if (pr.sequence <= 2) stId = doneStatus.id;
        else if (pr.sequence <= 5) stId = inProgressStatus.id;
        else if (pr.sequence <= 7) stId = waitingStatus.id;
        await supabase.from('case_processes').update({ status_id: stId }).eq('id', pr.id);
      }
      console.log('✓ Procesos sucesorios actualizados para embudo');
    }
  }

  // 6. CAJA CHICA: Cuentas de Fondos (cash_accounts)
  const { data: existingAccounts } = await supabase.from('cash_accounts').select('id, name');
  let acc1Id: string;
  let acc2Id: string;
  let acc3Id: string;

  if (!existingAccounts || existingAccounts.length === 0) {
    const { data: createdAccs, error: accErr } = await supabase.from('cash_accounts').insert([
      {
        name: 'Caja Chica Central - Efectivo',
        account_type: 'CASH',
        currency: 'PEN',
        opening_balance: 1500.0,
        responsible_user_id: adminUser.id,
        is_active: true,
      },
      {
        name: 'Cuenta Operativa BCP',
        account_type: 'BANK',
        currency: 'PEN',
        opening_balance: 12000.0,
        responsible_user_id: adminUser.id,
        is_active: true,
      },
      {
        name: 'Caja Fondo Dólares (USD)',
        account_type: 'CASH',
        currency: 'USD',
        opening_balance: 800.0,
        responsible_user_id: gestor1.id,
        is_active: true,
      },
    ]).select('id, name');
    if (accErr) throw accErr;
    acc1Id = createdAccs[0].id;
    acc2Id = createdAccs[1].id;
    acc3Id = createdAccs[2].id;
    console.log('✓ Cuentas de caja creadas: 3');
  } else {
    acc1Id = existingAccounts[0].id;
    acc2Id = existingAccounts[1]?.id || existingAccounts[0].id;
    acc3Id = existingAccounts[2]?.id || existingAccounts[0].id;
  }

  // 7. CAJA CHICA: Períodos Contables (cash_periods)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const periodStart = `${year}-${month}-01`;
  const periodEnd = `${year}-${month}-30`;

  const accounts = [acc1Id, acc2Id, acc3Id];
  for (const accId of accounts) {
    const { data: existingPeriod } = await supabase
      .from('cash_periods')
      .select('id')
      .eq('cash_account_id', accId)
      .eq('status', 'OPEN')
      .maybeSingle();

    if (!existingPeriod) {
      await supabase.from('cash_periods').insert({
        cash_account_id: accId,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'OPEN',
        notes: `Período contable mensual ${month}/${year}`,
      });
    }
  }
  console.log('✓ Períodos abiertos asegurados para todas las cuentas');

  // 8. CAJA CHICA: Solicitudes de fondos (cash_requests)
  const { data: existingReqs } = await supabase.from('cash_requests').select('id');
  if (!existingReqs || existingReqs.length === 0) {
    const { error: reqErr } = await supabase.from('cash_requests').insert([
      {
        request_number: `SOL-${year}-0001`,
        amount: 450.0,
        currency: 'PEN',
        category_code: 'TASAS_REGISTRALES',
        reason: 'Pago de derechos de inscripción SUNARP Partida 114258',
        status: 'PENDING',
        requested_by: gestor1.id,
        case_id: existingCases?.[0]?.id,
      },
      {
        request_number: `SOL-${year}-0002`,
        amount: 680.0,
        currency: 'PEN',
        category_code: 'GASTOS_NOTARIALES',
        reason: 'Derechos notariales por apertura de sucesión y testimonios',
        status: 'APPROVED',
        requested_by: gestor2.id,
        approved_by: adminUser.id,
        approved_at: new Date().toISOString(),
        case_id: existingCases?.[1]?.id,
      },
      {
        request_number: `SOL-${year}-0003`,
        amount: 320.0,
        currency: 'PEN',
        category_code: 'PUBLICACIONES',
        reason: 'Publicación de edicto sucesorio en El Peruano',
        status: 'DISBURSED',
        requested_by: gestor1.id,
        approved_by: adminUser.id,
        approved_at: new Date().toISOString(),
        disbursed_at: new Date().toISOString(),
        case_id: existingCases?.[2]?.id,
      },
    ]);
    if (reqErr) console.warn('Error insertando solicitudes:', reqErr.message);
    else console.log('✓ Solicitudes de fondos creadas: 3 (1 PENDING, 1 APPROVED, 1 DISBURSED)');
  }

  // 9. CAJA CHICA: Movimientos en Libro Diario (cash_movements)
  const { data: existingMovs } = await supabase.from('cash_movements').select('id');
  if (!existingMovs || existingMovs.length === 0) {
    const movementsPayload = [
      {
        movement_number: `MOV-${year}-0001`,
        cash_account_id: acc1Id,
        movement_type: 'INCOME',
        direction: 'IN',
        amount: 2500.0,
        category_code: 'OTROS',
        description: 'Aporte de cliente para provisión de gastos de sucesión',
        movement_date: `${year}-${month}-05`,
        case_id: existingCases?.[0]?.id,
        created_by: adminUser.id,
      },
      {
        movement_number: `MOV-${year}-0002`,
        cash_account_id: acc1Id,
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 650.0,
        category_code: 'GASTOS_NOTARIALES',
        description: 'Escritura pública notarial de sucesión intestada',
        movement_date: `${year}-${month}-08`,
        case_id: existingCases?.[0]?.id,
        created_by: adminUser.id,
      },
      {
        movement_number: `MOV-${year}-0003`,
        cash_account_id: acc1Id,
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 180.0,
        category_code: 'TASAS_REGISTRALES',
        description: 'Tasa registral SUNARP de copias literales y gravámenes',
        movement_date: `${year}-${month}-12`,
        case_id: existingCases?.[1]?.id,
        created_by: adminUser.id,
      },
      {
        movement_number: `MOV-${year}-0004`,
        cash_account_id: acc1Id,
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 320.0,
        category_code: 'PUBLICACIONES',
        description: 'Publicación de edicto sucesorio en Diario Oficial El Peruano',
        movement_date: `${year}-${month}-16`,
        case_id: existingCases?.[2]?.id,
        created_by: adminUser.id,
      },
      {
        movement_number: `MOV-${year}-0005`,
        cash_account_id: acc1Id,
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 85.0,
        category_code: 'SERVICIOS_TERCEROS',
        description: 'Movilidad y trámites de mensajería notarial urgente',
        movement_date: `${year}-${month}-20`,
        case_id: existingCases?.[3]?.id,
        created_by: adminUser.id,
      },
      {
        movement_number: `MOV-${year}-0006`,
        cash_account_id: acc1Id,
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 45.0,
        category_code: 'OTROS',
        description: 'Fotocopias legalizadas y certificados consulares',
        movement_date: `${year}-${month}-22`,
        case_id: existingCases?.[0]?.id,
        created_by: adminUser.id,
      },
      {
        movement_number: `MOV-${year}-0007`,
        cash_account_id: acc2Id,
        movement_type: 'INCOME',
        direction: 'IN',
        amount: 6000.0,
        category_code: 'OTROS',
        description: 'Transferencia bancaria de provisión de honorarios y gastos',
        movement_date: `${year}-${month}-02`,
        created_by: adminUser.id,
      },
      {
        movement_number: `MOV-${year}-0008`,
        cash_account_id: acc2Id,
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 1450.0,
        category_code: 'GASTOS_NOTARIALES',
        description: 'Minuta de partición de herencia y testimonios notariales',
        movement_date: `${year}-${month}-14`,
        case_id: existingCases?.[1]?.id,
        created_by: adminUser.id,
      },
    ];

    const { error: movErr } = await supabase.from('cash_movements').insert(movementsPayload);
    if (movErr) console.warn('Error insertando movimientos:', movErr.message);
    else console.log('✓ Movimientos contables creados: 8 (Ingresos y Egresos con categorías y casos)');
  }

  // 10. CAJA CHICA: Arqueos de caja (cash_reconciliations)
  const { data: existingRecs } = await supabase.from('cash_reconciliations').select('id');
  if (!existingRecs || existingRecs.length === 0) {
    const { error: recErr } = await supabase.from('cash_reconciliations').insert([
      {
        cash_account_id: acc1Id,
        reconciliation_date: `${year}-${month}-25`,
        period_start: periodStart,
        period_end: `${year}-${month}-25`,
        system_balance: 2720.0,
        counted_balance: 2720.0,
        status: 'APPROVED',
        opened_by: gestor1.id,
        approved_by: adminUser.id,
        approved_at: new Date().toISOString(),
        observations: 'Arqueo quincenal conforme, billetes y comprobantes coinciden al 100%',
      },
    ]);
    if (recErr) console.warn('Error insertando arqueos:', recErr.message);
    else console.log('✓ Arqueo de caja conforme creado');
  }

  console.log('\n============================================================');
  console.log('POBLADO DE DATOS DEMO COMPLETADO CON ÉXITO');
  console.log('============================================================');
}

seedDemoData().catch((err) => {
  console.error('Error en seed demo data:', err);
  process.exit(1);
});
