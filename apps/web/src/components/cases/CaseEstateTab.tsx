'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import {
  type CaseAssetItem,
  type CaseLiabilityItem,
  calculateConsolidatedEstate,
} from '@workflow/shared';
import { EstateSummaryCards } from './estate/EstateSummaryCards';
import { AssetsList } from './estate/AssetsList';
import { LiabilitiesList } from './estate/LiabilitiesList';
import { AssetModal } from './estate/AssetModal';
import { LiabilityModal } from './estate/LiabilityModal';

interface CaseEstateTabProps {
  caseId: string;
}

export const CaseEstateTab: React.FC<CaseEstateTabProps> = ({ caseId }) => {
  const [assets, setAssets] = useState<CaseAssetItem[]>([]);
  const [liabilities, setLiabilities] = useState<CaseLiabilityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CaseAssetItem | null>(null);
  const [isLiabModalOpen, setIsLiabModalOpen] = useState(false);
  const [editingLiab, setEditingLiab] = useState<CaseLiabilityItem | null>(null);

  const loadEstate = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const [assetsRes, liabRes] = await Promise.all([
        supabase
          .from('case_assets')
          .select('*')
          .eq('case_id', caseId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('case_liabilities')
          .select('*, creditor_person:persons(*)')
          .eq('case_id', caseId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);

      if (assetsRes.error) throw assetsRes.error;
      if (liabRes.error) throw liabRes.error;

      setAssets((assetsRes.data as CaseAssetItem[]) || []);
      setLiabilities((liabRes.data as CaseLiabilityItem[]) || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar inventario de patrimonio');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadEstate();
  }, [loadEstate]);

  const handleDeactivate = async (table: 'case_assets' | 'case_liabilities', id: string) => {
    if (!confirm('¿Está seguro de retirar este registro del inventario?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from(table).update({ is_active: false }).eq('id', id);
      if (error) throw error;
      await loadEstate();
    } catch (err: unknown) {
      alert((err as Error).message || 'Error al retirar registro');
    }
  };

  const summary = calculateConsolidatedEstate(assets, liabilities);

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Cargando inventario de patrimonio...</div>;
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {errorMessage}
        </div>
      )}

      {/* Tarjetas de consolidado */}
      <EstateSummaryCards summary={summary} />

      {/* Bienes y Activos */}
      <AssetsList
        assets={assets}
        onOpenCreate={() => {
          setEditingAsset(null);
          setIsAssetModalOpen(true);
        }}
        onOpenEdit={(asset) => {
          setEditingAsset(asset);
          setIsAssetModalOpen(true);
        }}
        onDeactivate={(id) => handleDeactivate('case_assets', id)}
      />

      {/* Deudas y Pasivos */}
      <LiabilitiesList
        liabilities={liabilities}
        onOpenCreate={() => {
          setEditingLiab(null);
          setIsLiabModalOpen(true);
        }}
        onOpenEdit={(liab) => {
          setEditingLiab(liab);
          setIsLiabModalOpen(true);
        }}
        onDeactivate={(id) => handleDeactivate('case_liabilities', id)}
      />

      {/* Modales */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        caseId={caseId}
        editingAsset={editingAsset}
        onSaved={loadEstate}
      />

      <LiabilityModal
        isOpen={isLiabModalOpen}
        onClose={() => setIsLiabModalOpen(false)}
        caseId={caseId}
        editingLiab={editingLiab}
        onSaved={loadEstate}
      />
    </div>
  );
};
