'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import {
  type CasePartyItem,
  type PartyRole,
  validateCaseSemaphore,
} from '@workflow/shared';
import { AlertTriangle } from 'lucide-react';
import { CausanteCard } from './parties/CausanteCard';
import { HeirsList } from './parties/HeirsList';
import { PartyModal } from './parties/PartyModal';

interface CasePartiesTabProps {
  caseId: string;
  isConfidential?: boolean;
}

export const CasePartiesTab: React.FC<CasePartiesTabProps> = ({ caseId }) => {
  const [parties, setParties] = useState<CasePartyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<CasePartyItem | null>(null);
  const [defaultRole, setDefaultRole] = useState<PartyRole>('HEREDERO');

  const loadParties = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('case_parties')
        .select(`
          *,
          person:persons!case_parties_person_id_fkey (*),
          representative:persons!case_parties_represented_by_fkey (*)
        `)
        .eq('case_id', caseId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setParties((data as unknown as CasePartyItem[]) || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar intervinientes');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const handleDeactivateParty = async (partyId: string) => {
    if (!confirm('¿Está seguro de retirar este interviniente del caso?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('case_parties')
        .update({ is_active: false })
        .eq('id', partyId);
      if (error) throw error;
      await loadParties();
    } catch (err: unknown) {
      alert((err as Error).message || 'Error al desactivar interviniente');
    }
  };

  const semaphore = validateCaseSemaphore(null, parties);
  const causante = parties.find((p) => p.party_role === 'CAUSANTE');
  const heirs = parties.filter((p) => p.party_role === 'HEREDERO');

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Cargando intervinientes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 1. Alerta de Semáforos Activos */}
      {semaphore.hasWarnings && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Advertencias Semáforo del Caso ({semaphore.warnings.length})</span>
          </div>
          <ul className="text-xs space-y-1 pl-6 list-disc">
            {semaphore.warnings.map((w, idx) => (
              <li key={idx}>
                <strong>{w.title}:</strong> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {errorMessage}
        </div>
      )}

      {/* 2. Sección Causante */}
      <CausanteCard
        causante={causante}
        onOpenCreate={() => {
          setEditingParty(null);
          setDefaultRole('CAUSANTE');
          setIsModalOpen(true);
        }}
        onOpenEdit={(c) => {
          setEditingParty(c);
          setDefaultRole('CAUSANTE');
          setIsModalOpen(true);
        }}
      />

      {/* 3. Sección Herederos */}
      <HeirsList
        heirs={heirs}
        totalConfirmedShare={semaphore.totalConfirmedShare}
        onOpenCreate={() => {
          setEditingParty(null);
          setDefaultRole('HEREDERO');
          setIsModalOpen(true);
        }}
        onOpenEdit={(h) => {
          setEditingParty(h);
          setDefaultRole('HEREDERO');
          setIsModalOpen(true);
        }}
        onDeactivate={handleDeactivateParty}
      />

      {/* Modal */}
      <PartyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        caseId={caseId}
        editingParty={editingParty}
        defaultRole={defaultRole}
        parties={parties}
        onSaved={loadParties}
      />
    </div>
  );
};
