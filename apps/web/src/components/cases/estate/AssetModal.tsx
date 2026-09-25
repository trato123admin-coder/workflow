'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase/client';
import {
  type CaseAssetItem,
  type AssetType,
  type EstateCurrency,
  type AssetStatus,
  CreateCaseAssetSchema,
  ASSET_TYPES,
  ASSET_STATUSES,
  ESTATE_CURRENCIES,
} from '@workflow/shared';
import { Modal } from '../../ui/Modal';
import { FormField } from '../../ui/FormField';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  editingAsset: CaseAssetItem | null;
  onSaved: () => Promise<void>;
}

export const AssetModal: React.FC<AssetModalProps> = ({
  isOpen,
  onClose,
  caseId,
  editingAsset,
  onSaved,
}) => {
  const [assetType, setAssetType] = useState<AssetType>('INMUEBLE');
  const [assetDesc, setAssetDesc] = useState('');
  const [registryOffice, setRegistryOffice] = useState('');
  const [registryRef, setRegistryRef] = useState('');
  const [ownershipPercent, setOwnershipPercent] = useState('100');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [assetCurrency, setAssetCurrency] = useState<EstateCurrency>('PEN');
  const [assetStatus, setAssetStatus] = useState<AssetStatus>('IDENTIFICADO');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingAsset) {
      setAssetType(editingAsset.asset_type);
      setAssetDesc(editingAsset.description);
      setRegistryOffice(editingAsset.registry_office || '');
      setRegistryRef(editingAsset.registry_ref || '');
      setOwnershipPercent(String(editingAsset.ownership_percent));
      setEstimatedValue(editingAsset.estimated_value !== null ? String(editingAsset.estimated_value) : '');
      setAssetCurrency(editingAsset.currency);
      setAssetStatus(editingAsset.status);
    } else {
      setAssetType('INMUEBLE');
      setAssetDesc('');
      setRegistryOffice('');
      setRegistryRef('');
      setOwnershipPercent('100');
      setEstimatedValue('');
      setAssetCurrency('PEN');
      setAssetStatus('IDENTIFICADO');
    }
    setFormError(null);
  }, [editingAsset, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      case_id: caseId,
      asset_type: assetType,
      description: assetDesc.trim(),
      registry_office: registryOffice.trim() || null,
      registry_ref: registryRef.trim() || null,
      ownership_percent: Number(ownershipPercent) || 100,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      currency: assetCurrency,
      status: assetStatus,
    };

    const parsed = CreateCaseAssetSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message || 'Datos de activo inválidos');
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      if (editingAsset) {
        const { error } = await supabase.from('case_assets').update(payload).eq('id', editingAsset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('case_assets').insert(payload);
        if (error) throw error;
      }
      onClose();
      await onSaved();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Error al guardar activo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAsset ? 'Editar Bien' : 'Registrar Bien en Patrimonio'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="f-asset-type" label="Tipo de Bien" required>
            <select
              id="f-asset-type"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>

          <FormField id="f-asset-status" label="Estado del Bien">
            <select
              id="f-asset-status"
              value={assetStatus}
              onChange={(e) => setAssetStatus(e.target.value as AssetStatus)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id="f-asset-desc" label="Descripción del Bien" required>
          <input
            id="f-asset-desc"
            type="text"
            placeholder="Ej. Casa habitación en Urb. Miraflores"
            value={assetDesc}
            onChange={(e) => setAssetDesc(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="f-registry-office" label="Oficina / Sede Registral">
            <input
              id="f-registry-office"
              type="text"
              placeholder="Ej. SUNARP Lima"
              value={registryOffice}
              onChange={(e) => setRegistryOffice(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            />
          </FormField>

          <FormField
            id="f-registry-ref"
            label={
              assetType === 'CUENTA_BANCARIA'
                ? 'Últimos 4 dígitos de Cuenta'
                : 'N.º Partida / Placa / Referencia'
            }
          >
            <input
              id="f-registry-ref"
              type="text"
              maxLength={assetType === 'CUENTA_BANCARIA' ? 4 : undefined}
              placeholder={assetType === 'CUENTA_BANCARIA' ? '1234' : 'Ej. 11029384'}
              value={registryRef}
              onChange={(e) => setRegistryRef(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
            />
            {assetType === 'CUENTA_BANCARIA' && (
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Regla de seguridad: SOLO ingrese los últimos 4 dígitos.
              </span>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField id="f-ownership" label="% Propiedad">
            <input
              id="f-ownership"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={ownershipPercent}
              onChange={(e) => setOwnershipPercent(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
            />
          </FormField>

          <FormField id="f-est-val" label="Valor Estimado">
            <input
              id="f-est-val"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
            />
          </FormField>

          <FormField id="f-currency" label="Moneda">
            <select
              id="f-currency"
              value={assetCurrency}
              onChange={(e) => setAssetCurrency(e.target.value as EstateCurrency)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {ESTATE_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
