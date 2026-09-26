'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase/client';
import {
  type CasePartyItem,
  type PartyRole,
  type RelationshipType,
  type HeirStatus,
  type PersonItem,
  PARTY_ROLES,
  RELATIONSHIP_TYPES,
  HEIR_STATUSES,
} from '@workflow/shared';
import { Modal } from '../../ui/Modal';
import { FormField } from '../../ui/FormField';
import { PersonPicker } from '../../persons/PersonPicker';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  editingParty: CasePartyItem | null;
  defaultRole?: PartyRole;
  parties: CasePartyItem[];
  onSaved: () => Promise<void>;
}

export const PartyModal: React.FC<PartyModalProps> = ({
  isOpen,
  onClose,
  caseId,
  editingParty,
  defaultRole = 'HEREDERO',
  parties,
  onSaved,
}) => {
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [partyRole, setPartyRole] = useState<PartyRole>(defaultRole);
  const [relationship, setRelationship] = useState<RelationshipType>('HIJO');
  const [heirStatus, setHeirStatus] = useState<HeirStatus>('PRESUNTO');
  const [sharePercent, setSharePercent] = useState<string>('');
  const [representedBy, setRepresentedBy] = useState<string>('');
  const [deathDate, setDeathDate] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingParty) {
      setSelectedPerson(editingParty.person || null);
      setPartyRole(editingParty.party_role);
      setRelationship(editingParty.relationship_to_deceased || 'OTRO');
      setHeirStatus(editingParty.heir_status || 'PRESUNTO');
      setSharePercent(
        editingParty.share_percent !== null ? String(editingParty.share_percent) : '',
      );
      setRepresentedBy(editingParty.represented_by || '');
      setDeathDate(editingParty.person?.death_date || '');
    } else {
      setSelectedPerson(null);
      setPartyRole(defaultRole);
      setRelationship('HIJO');
      setHeirStatus('PRESUNTO');
      setSharePercent('');
      setRepresentedBy('');
      setDeathDate('');
    }
    setFormError(null);
  }, [editingParty, defaultRole, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson && !editingParty) {
      setFormError('Debe seleccionar una persona');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const personId = selectedPerson?.id || editingParty?.person_id;

      if (partyRole === 'CAUSANTE' && deathDate && personId) {
        await supabase
          .from('persons')
          .update({ death_date: deathDate, is_deceased: true })
          .eq('id', personId);
      }

      const payload = {
        case_id: caseId,
        person_id: personId,
        party_role: partyRole,
        relationship_to_deceased: partyRole === 'HEREDERO' ? relationship : null,
        heir_status: partyRole === 'HEREDERO' ? heirStatus : null,
        share_percent:
          partyRole === 'HEREDERO' && sharePercent.trim() !== '' ? Number(sharePercent) : null,
        represented_by: representedBy || null,
        is_active: true,
      };

      if (editingParty) {
        const { error } = await supabase
          .from('case_parties')
          .update(payload)
          .eq('id', editingParty.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('case_parties').insert(payload);
        if (error) throw error;
      }

      onClose();
      await onSaved();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Error al guardar interviniente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingParty ? 'Editar Interviniente' : 'Registrar Interviniente'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {formError}
          </div>
        )}

        {!editingParty ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              Seleccionar Persona Existente o Crear Nueva
            </label>
            <PersonPicker
              selectedPersonId={selectedPerson?.id || null}
              onSelectPerson={(p) => setSelectedPerson(p)}
            />
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs">
            Persona:{' '}
            <strong className="text-foreground">
              {editingParty.person?.first_name} {editingParty.person?.last_name}
            </strong>{' '}
            ({editingParty.person?.identity_document_type}:{' '}
            {editingParty.person?.identity_document_number})
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="f-party-role" label="Rol en el Caso" required>
            <select
              id="f-party-role"
              value={partyRole}
              onChange={(e) => setPartyRole(e.target.value as PartyRole)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {PARTY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </FormField>

          {partyRole === 'HEREDERO' && (
            <FormField id="f-relationship" label="Parentesco">
              <select
                id="f-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as RelationshipType)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
              >
                {RELATIONSHIP_TYPES.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        {partyRole === 'CAUSANTE' && (
          <FormField id="f-death-date" label="Fecha de Defunción">
            <input
              id="f-death-date"
              type="date"
              value={deathDate}
              onChange={(e) => setDeathDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            />
          </FormField>
        )}

        {partyRole === 'HEREDERO' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="f-heir-status" label="Condición de Heredero">
              <select
                id="f-heir-status"
                value={heirStatus}
                onChange={(e) => setHeirStatus(e.target.value as HeirStatus)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
              >
                {HEIR_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="f-share-percent" label="Cuota Hereditaria (%)">
              <input
                id="f-share-percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Ej. 33.33"
                value={sharePercent}
                onChange={(e) => setSharePercent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
              />
            </FormField>
          </div>
        )}

        {partyRole === 'HEREDERO' && (
          <FormField id="f-represented-by" label="Representado por (Tutor / Apoderado)">
            <select
              id="f-represented-by"
              value={representedBy}
              onChange={(e) => setRepresentedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              <option value="">-- Sin representante --</option>
              {parties
                .filter(
                  (p) =>
                    p.person_id !== selectedPerson?.id && p.person_id !== editingParty?.person_id,
                )
                .map((p) => (
                  <option key={p.person_id} value={p.person_id}>
                    {p.person?.first_name} {p.person?.last_name} ({p.party_role})
                  </option>
                ))}
            </select>
          </FormField>
        )}

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
