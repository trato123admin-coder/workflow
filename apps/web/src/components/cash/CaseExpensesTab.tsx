'use client';

import React from 'react';
import { calculateCaseExpenses } from '@workflow/shared';
import type { CashMovement } from '@workflow/shared';
import { Plus, Receipt, FileText } from 'lucide-react';

interface CaseExpensesTabProps {
  caseId: string;
  caseNumber: string;
  movements: CashMovement[];
  canRequestFunds?: boolean;
  onOpenRequest: () => void;
  onDownloadSupport?: (path: string) => void;
}

export const CaseExpensesTab: React.FC<CaseExpensesTabProps> = ({
  caseId,
  caseNumber,
  movements,
  canRequestFunds = true,
  onOpenRequest,
  onDownloadSupport,
}) => {
  const summary = React.useMemo(() => {
    return calculateCaseExpenses(movements, caseId);
  }, [movements, caseId]);

  const caseMovements = movements.filter((m) => m.case_id === caseId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabecera y Resumen de Gastos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Costos Operativos y Caja Chica del Expediente {caseNumber}
          </h3>
          <p className="text-xs text-muted-foreground">
            Imputación de tasas notariales, aranceles registrales y gastos operativos directos (M9)
          </p>
        </div>

        {canRequestFunds && (
          <button
            type="button"
            onClick={onOpenRequest}
            className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Solicitar Fondos para este Caso
          </button>
        )}
      </div>

      {/* Tarjetas de Consolidación */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground">Total Egresos Imputados</span>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
            S/ {summary.totalExpense.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {summary.count} operaciones registradas
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground">Devoluciones / Reingresos</span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            S/ {summary.totalIncome.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground">Saldos o tasas devueltas</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground">Costo Neto del Caso</span>
          <div className="text-xl font-bold text-foreground font-mono">
            S/ {summary.netExpense.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground">Gasto real acumulado</p>
        </div>
      </div>

      {/* Desglose por Categoría Contable */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Desglose por Categoría
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(summary.byCategory).map(([cat, val]) => (
            <div key={cat} className="p-2.5 rounded-lg bg-muted/40 border border-border/80">
              <span className="text-[11px] text-muted-foreground truncate block">
                {cat.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                S/ {val.toFixed(2)}
              </span>
            </div>
          ))}
          {Object.keys(summary.byCategory).length === 0 && (
            <div className="col-span-full py-2 text-xs text-muted-foreground italic">
              Sin gastos desglosados en este expediente
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Movimientos del Caso */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">Detalle de Asientos del Caso</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {caseMovements.length} asientos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-4">Fecha</th>
                <th className="py-2.5 px-4">Asiento</th>
                <th className="py-2.5 px-4">Categoría</th>
                <th className="py-2.5 px-4">Descripción</th>
                <th className="py-2.5 px-4">Comprobante</th>
                <th className="py-2.5 px-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {caseMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No se registran desembolsos de caja chica vinculados a este expediente
                  </td>
                </tr>
              ) : (
                caseMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground font-mono">
                      {m.movement_date}
                    </td>
                    <td className="py-2.5 px-4 font-bold font-mono text-foreground">
                      {m.movement_number || 'MOV-PND'}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-foreground">
                      {m.category_code?.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {m.description}
                      {m.reference && (
                        <span className="ml-1 text-[10px] bg-muted px-1 rounded">
                          Ref: {m.reference}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {m.support_document_path ? (
                        <button
                          type="button"
                          onClick={() => onDownloadSupport?.(m.support_document_path!)}
                          className="text-primary hover:underline flex items-center gap-1 font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" /> Ver Adjunto
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      <span className={m.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                        {m.direction === 'IN' ? '+' : '-'} S/ {m.amount?.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
