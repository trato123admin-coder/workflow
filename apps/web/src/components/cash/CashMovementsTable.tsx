'use client';

import React, { useState } from 'react';
import { Plus, RotateCcw, FileText, Search, Briefcase } from 'lucide-react';
import type { CashMovement, CashAccountBalance } from '@workflow/shared';

interface CashMovementsTableProps {
  movements: CashMovement[];
  accounts: CashAccountBalance[];
  categories: Array<{ code: string; label: string }>;
  canWrite?: boolean;
  onOpenCreate: () => void;
  onOpenReversal: (m: CashMovement) => void;
  onDownloadSupport?: (path: string) => void;
}

export const CashMovementsTable: React.FC<CashMovementsTableProps> = ({
  movements,
  accounts,
  categories,
  canWrite = false,
  onOpenCreate,
  onOpenReversal,
  onDownloadSupport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // IDs de movimientos que ya han sido reversados
  const reversedIds = new Set(movements.filter((m) => m.reversal_of).map((m) => m.reversal_of!));

  const filtered = movements.filter((m) => {
    if (selectedAccount !== 'ALL' && m.cash_account_id !== selectedAccount) return false;
    if (selectedType !== 'ALL' && m.movement_type !== selectedType) return false;
    if (selectedCategory !== 'ALL' && m.category_code !== selectedCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchDesc = m.description?.toLowerCase().includes(q);
      const matchNum = m.movement_number?.toLowerCase().includes(q);
      const matchRef = m.reference?.toLowerCase().includes(q);
      return matchDesc || matchNum || matchRef;
    }
    return true;
  });

  const getAccountName = (accId: string) => {
    return accounts.find((a) => a.cash_account_id === accId)?.account_name || 'Caja';
  };

  const getCategoryLabel = (catCode: string) => {
    return categories.find((c) => c.code === catCode)?.label || catCode.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Libro Diario de Caja</h3>
          <p className="text-xs text-muted-foreground">
            Registro cronológico inmutable de entradas y salidas de fondos
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={onOpenCreate}
            className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Registrar Movimiento
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-card p-3 rounded-xl border border-border text-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por descripción o N.º..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background"
          />
        </div>

        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background"
        >
          <option value="ALL">Todas las cajas</option>
          {accounts.map((a) => (
            <option key={a.cash_account_id} value={a.cash_account_id}>
              {a.account_name}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background"
        >
          <option value="ALL">Todos los tipos</option>
          <option value="EXPENSE">Egresos</option>
          <option value="INCOME">Ingresos</option>
          <option value="REVERSAL">Reversos</option>
          <option value="ADJUSTMENT">Ajustes</option>
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background"
        >
          <option value="ALL">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla de Movimientos */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Asiento / Fecha</th>
                <th className="py-3 px-4">Cuenta</th>
                <th className="py-3 px-4">Categoría & Detalle</th>
                <th className="py-3 px-4">Expediente</th>
                <th className="py-3 px-4">Comprobante</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No se encontraron movimientos con los filtros aplicados
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isReversal = m.movement_type === 'REVERSAL';
                  const isAlreadyReversed = reversedIds.has(m.id!);
                  const canBeReversed = canWrite && !isReversal && !isAlreadyReversed;

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isAlreadyReversed ? 'opacity-60 bg-muted/10 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-foreground">
                          {m.movement_number || 'MOV-PND'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{m.movement_date}</div>
                      </td>

                      <td className="py-3 px-4 font-medium text-foreground">
                        {getAccountName(m.cash_account_id)}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-foreground truncate">
                          {getCategoryLabel(m.category_code)}
                        </div>
                        <div
                          className="text-[11px] text-muted-foreground truncate"
                          title={m.description}
                        >
                          {m.description}
                          {m.reference && (
                            <span className="ml-1 font-mono text-[10px] bg-muted px-1 rounded">
                              Ref: {m.reference}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {m.case_id ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            <Briefcase className="w-3 h-3" /> Vinculado
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {m.support_document_path ? (
                          <button
                            type="button"
                            onClick={() => onDownloadSupport?.(m.support_document_path!)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" /> Ver Adjunto
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Sin sustento</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={
                            m.direction === 'IN'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {m.direction === 'IN' ? '+' : '-'} S/ {m.amount?.toFixed(2)}
                        </span>
                        {isReversal && (
                          <div className="text-[10px] text-amber-600 font-sans italic">Reverso</div>
                        )}
                        {isAlreadyReversed && (
                          <div className="text-[10px] text-muted-foreground font-sans italic">
                            Anulado
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {canBeReversed && (
                          <button
                            type="button"
                            onClick={() => onOpenReversal(m)}
                            className="px-2 py-1 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto"
                            title="Reversar este movimiento contable"
                          >
                            <RotateCcw className="w-3 h-3" /> Reversar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
