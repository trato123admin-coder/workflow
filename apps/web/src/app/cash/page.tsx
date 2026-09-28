'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { CashKpiCards } from '../../components/cash/CashKpiCards';
import { CashCharts } from '../../components/cash/CashCharts';
import { CashMovementsTable } from '../../components/cash/CashMovementsTable';
import { CashRequestsTable } from '../../components/cash/CashRequestsTable';
import { CashReconciliationsTable } from '../../components/cash/CashReconciliationsTable';
import { MovementModal } from '../../components/cash/MovementModal';
import { ReversalModal } from '../../components/cash/ReversalModal';
import { RequestModal } from '../../components/cash/RequestModal';
import { ReconciliationModal } from '../../components/cash/ReconciliationModal';
import { Coins, Receipt, HandCoins, Scale, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useCashData } from '../../lib/useCashData';
import type { CashMovement } from '@workflow/shared';

export default function CashPage() {
  const [activeTab, setActiveTab] = useState<'movements' | 'requests' | 'reconciliations'>('movements');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [reversingMovement, setReversingMovement] = useState<CashMovement | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);

  const {
    balances, movements, requests, reconciliations, periods, categories, cases,
    isLoading, errorMessage, currentUserId, isMfaActive,
    canWrite, canApprove,
    loadData, handleSaveMovement, handleConfirmReversal, handleSaveRequest,
    handleApproveRequest, handleRejectRequest, handleDisburseRequest,
    handleSaveReconciliation, handleApproveReconciliation, handleRejectReconciliation,
    handleDownloadSupport,
  } = useCashData();

  const pendingRequestsCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Coins className="w-6 h-6 text-primary" />
              Gestión de Caja Chica
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Libro contable inmutable, control dual de arqueo y seguimiento de gastos por caso
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-muted-foreground flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <CashKpiCards
          balances={balances}
          pendingRequestsCount={pendingRequestsCount}
          isMfaActive={isMfaActive}
        />

        <CashCharts balances={balances} movements={movements} />

        <div className="flex border-b border-border text-xs font-semibold gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`pb-3 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'movements'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Libro Diario ({movements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`pb-3 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'requests'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            <span>Solicitudes de Fondos ({requests.length})</span>
            {pendingRequestsCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reconciliations')}
            className={`pb-3 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'reconciliations'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Arqueo y Cierre ({reconciliations.length})</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Sincronizando libro contable...</span>
          </div>
        ) : (
          <>
            {activeTab === 'movements' && (
              <CashMovementsTable
                movements={movements}
                accounts={balances}
                categories={categories}
                canWrite={canWrite}
                onOpenCreate={() => setIsMovementModalOpen(true)}
                onOpenReversal={(m) => setReversingMovement(m)}
                onDownloadSupport={handleDownloadSupport}
              />
            )}

            {activeTab === 'requests' && (
              <CashRequestsTable
                requests={requests}
                accounts={balances}
                canApprove={canApprove}
                canDisburse={canWrite}
                onOpenCreate={() => setIsRequestModalOpen(true)}
                onApprove={handleApproveRequest}
                onReject={handleRejectRequest}
                onDisburse={handleDisburseRequest}
              />
            )}

            {activeTab === 'reconciliations' && (
              <CashReconciliationsTable
                reconciliations={reconciliations}
                currentUserId={currentUserId}
                canApprove={canApprove}
                onOpenCreate={() => setIsReconciliationModalOpen(true)}
                onApprove={handleApproveReconciliation}
                onReject={handleRejectReconciliation}
              />
            )}
          </>
        )}

        <MovementModal
          isOpen={isMovementModalOpen}
          onClose={() => setIsMovementModalOpen(false)}
          accounts={balances}
          categories={categories}
          cases={cases}
          onSave={handleSaveMovement}
        />

        <ReversalModal
          isOpen={Boolean(reversingMovement)}
          onClose={() => setReversingMovement(null)}
          movement={reversingMovement}
          onConfirm={handleConfirmReversal}
        />

        <RequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          categories={categories}
          cases={cases}
          onSave={handleSaveRequest}
        />

        <ReconciliationModal
          isOpen={isReconciliationModalOpen}
          onClose={() => setIsReconciliationModalOpen(false)}
          accounts={balances}
          openPeriods={periods}
          onSave={handleSaveReconciliation}
        />
      </div>
    </AppShell>
  );
}
