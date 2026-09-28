'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../../components/layout/AppShell';
import { CaseProcessesTable } from '../../../components/cases/CaseProcessesTable';
import { CaseKanbanBoard } from '../../../components/cases/CaseKanbanBoard';
import { CasePartiesTab } from '../../../components/cases/CasePartiesTab';
import { CaseEstateTab } from '../../../components/cases/CaseEstateTab';
import { CaseActivityTab } from '../../../components/cases/CaseActivityTab';
import { CaseDocumentsTab } from '../../../components/cases/CaseDocumentsTab';
import { CaseFilingsTab } from '../../../components/cases/filings/CaseFilingsTab';
import { CaseExpensesTab } from '../../../components/cash/CaseExpensesTab';
import { RequestModal } from '../../../components/cash/RequestModal';
import { CaseHeader } from '../../../components/cases/CaseHeader';
import { createClient } from '../../../lib/supabase/client';
import { useCaseDetail } from './useCaseDetail';
import type { CashMovement } from '@workflow/shared';
import {
  Lock,
  Clock,
  XCircle,
  CheckCircle2,
  ArrowLeft,
  Users,
  Building,
  LayoutGrid,
  List,
  MessageSquare,
  FileText,
  ExternalLink,
  Coins,
} from 'lucide-react';

type DetailTab =
  'processes' | 'parties' | 'estate' | 'documents' | 'filings' | 'activity' | 'expenses';
type ProcessView = 'table' | 'kanban';

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [activeTab, setActiveTab] = useState<DetailTab>('processes');
  const [processView, setProcessView] = useState<ProcessView>('kanban');
  const [caseMovements, setCaseMovements] = useState<CashMovement[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [categories, setCategories] = useState<Array<{ code: string; label: string }>>([]);

  const {
    caseData,
    processes,
    statuses,
    isUpdating,
    errorMessage,
    successMessage,
    unauthorized,
    handleAdvanceProcess,
    handleCloseCase,
  } = useCaseDetail(caseId);

  React.useEffect(() => {
    if (!caseId) return;
    const supabase = createClient();
    supabase
      .from('cash_movements')
      .select('*')
      .eq('case_id', caseId)
      .order('movement_date', { ascending: false })
      .then(({ data }) => {
        if (data) setCaseMovements(data as CashMovement[]);
      });

    supabase
      .from('catalog_items')
      .select('code, label')
      .eq('catalog_code', 'cash_categories')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, [caseId, activeTab]);

  const handleSaveRequestFromCase = async (req: {
    amount: number;
    currency: string;
    category_code: string;
    reason: string;
    case_id?: string;
  }) => {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const correlative = `SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await supabase.from('cash_requests').insert({
      request_number: correlative,
      amount: req.amount,
      currency: req.currency,
      category_code: req.category_code,
      reason: req.reason,
      case_id: caseId,
      requested_by: authData?.user?.id,
      status: 'PENDING',
    });
  };

  if (unauthorized) {
    return (
      <AppShell breadcrumbs={[{ label: 'Inicio', href: '/cases' }, { label: 'Acceso Denegado' }]}>
        <div className="p-12 text-center max-w-md mx-auto space-y-4">
          <div className="p-3 rounded-full bg-destructive/10 text-destructive w-12 h-12 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Caso No Encontrado o Acceso Denegado
          </h2>
          <p className="text-xs text-muted-foreground">
            No tiene permisos para visualizar este caso por política de seguridad a nivel de fila
            (RLS).
          </p>
          <Link
            href="/cases"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Casos</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const client = caseData?.client_person;
  const clientName = client
    ? client.person_type === 'JURIDICA'
      ? client.legal_name || 'Razón Social'
      : `${client.first_name || ''} ${client.last_name || ''}`.trim()
    : 'Sin cliente asignado';

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Inicio', href: '/cases' },
        { label: 'Casos', href: '/cases' },
        { label: caseData?.case_number || 'Expediente' },
      ]}
    >
      <div className="space-y-6">
        <CaseHeader
          caseData={caseData}
          clientName={clientName}
          isUpdating={isUpdating}
          onCloseCase={handleCloseCase}
        />

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Operación bloqueada por regla de negocio o compuerta</span>
            </div>
            <p className="pl-6">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Barra de Pestañas de Detalle de Caso */}
        <div className="flex items-center justify-between border-b border-border pb-px">
          <div className="flex gap-6 text-xs font-semibold">
            {[
              { id: 'processes' as const, l: `Procesos (${processes.length})`, i: Clock },
              { id: 'parties' as const, l: 'Personas', i: Users },
              { id: 'estate' as const, l: 'Patrimonio', i: Building },
              { id: 'documents' as const, l: 'Documentos', i: FileText },
              { id: 'filings' as const, l: 'Trámites externos', i: ExternalLink },
              { id: 'activity' as const, l: 'Actividad', i: MessageSquare },
              { id: 'expenses' as const, l: 'Gastos de caja', i: Coins },
            ].map(({ id, l, i: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`pb-3 flex items-center gap-1.5 border-b-2 transition-all ${
                  activeTab === id
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{l}</span>
              </button>
            ))}
          </div>

          {activeTab === 'processes' && (
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setProcessView('kanban')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  processView === 'kanban'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setProcessView('table')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  processView === 'table'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista Tabla"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabla</span>
              </button>
            </div>
          )}
        </div>

        {/* Contenido según pestaña activa */}
        {activeTab === 'processes' && (
          <div>
            {processView === 'kanban' ? (
              <CaseKanbanBoard
                processes={processes}
                workflowStatuses={statuses}
                onAdvanceProcess={handleAdvanceProcess}
                isUpdating={isUpdating}
              />
            ) : (
              <CaseProcessesTable
                processes={processes}
                workflowStatuses={statuses}
                onAdvanceProcess={handleAdvanceProcess}
                isUpdating={isUpdating}
              />
            )}
          </div>
        )}

        {activeTab === 'parties' && (
          <CasePartiesTab caseId={caseId} isConfidential={caseData?.is_confidential} />
        )}

        {activeTab === 'estate' && <CaseEstateTab caseId={caseId} />}

        {activeTab === 'documents' && <CaseDocumentsTab caseId={caseId} />}

        {activeTab === 'filings' && <CaseFilingsTab caseId={caseId} />}

        {activeTab === 'activity' && <CaseActivityTab caseId={caseId} />}

        {activeTab === 'expenses' && (
          <CaseExpensesTab
            caseId={caseId}
            caseNumber={caseData?.case_number || ''}
            movements={caseMovements}
            onOpenRequest={() => setIsRequestModalOpen(true)}
          />
        )}

        <RequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          categories={categories}
          cases={
            caseData
              ? [{ id: caseData.id, case_number: caseData.case_number, title: caseData.title }]
              : []
          }
          initialCaseId={caseId}
          onSave={handleSaveRequestFromCase}
        />
      </div>
    </AppShell>
  );
}
