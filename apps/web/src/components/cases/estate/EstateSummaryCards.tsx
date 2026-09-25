'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import type { ConsolidatedEstateSummary } from '@workflow/shared';

interface EstateSummaryCardsProps {
  summary: ConsolidatedEstateSummary;
}

export const EstateSummaryCards: React.FC<EstateSummaryCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 rounded-2xl border border-border bg-card space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Masa Activa ({summary.assetsCount} bienes)
          </span>
        </div>
        <div className="space-y-0.5 pt-1">
          <div className="text-lg font-bold text-foreground font-mono">
            S/ {summary.totalAssetsPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          {summary.totalAssetsUsd > 0 && (
            <div className="text-xs font-semibold text-muted-foreground font-mono">
              $ {summary.totalAssetsUsd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-destructive" />
            Masa Pasiva ({summary.liabilitiesCount} deudas)
          </span>
        </div>
        <div className="space-y-0.5 pt-1">
          <div className="text-lg font-bold text-destructive font-mono">
            S/ {summary.totalLiabilitiesPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          {summary.totalLiabilitiesUsd > 0 && (
            <div className="text-xs font-semibold text-muted-foreground font-mono">
              $ {summary.totalLiabilitiesUsd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-primary" />
            Patrimonio Neto Estimado
          </span>
        </div>
        <div className="space-y-0.5 pt-1">
          <div
            className={`text-lg font-bold font-mono ${
              summary.netEstatePen >= 0 ? 'text-primary' : 'text-destructive'
            }`}
          >
            S/ {summary.netEstatePen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          {summary.netEstateUsd !== 0 && (
            <div className="text-xs font-semibold text-muted-foreground font-mono">
              $ {summary.netEstateUsd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
