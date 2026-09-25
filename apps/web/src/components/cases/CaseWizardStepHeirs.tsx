'use client';

import React, { useState } from 'react';
import { PersonPicker } from '../persons/PersonPicker';
import { FormField } from '../ui/FormField';
import {
  type InitialPartyInput,
  type PersonItem,
  type RelationshipType,
  type HeirStatus,
  RELATIONSHIP_TYPES,
  HEIR_STATUSES,
  isMinor,
  calculateAge,
} from '@workflow/shared';
import { Users, Plus, Trash2, ShieldAlert, Percent } from 'lucide-react';

interface HeirEntry extends InitialPartyInput {
  personName: string;
  docNumber: string;
  birthDate?: string | null;
}

interface CaseWizardStepHeirsProps {
  heirs: HeirEntry[];
  onAddHeir: (heir: HeirEntry) => void;
  onRemoveHeir: (personId: string) => void;
  availablePersons: PersonItem[];
}

export const CaseWizardStepHeirs: React.FC<CaseWizardStepHeirsProps> = ({
  heirs,
  onAddHeir,
  onRemoveHeir,
}) => {
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [relationship, setRelationship] = useState<RelationshipType>('HIJO');
  const [heirStatus, setHeirStatus] = useState<HeirStatus>('PRESUNTO');
  const [sharePercent, setSharePercent] = useState('');
  const [representedBy, setRepresentedBy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalQuota = heirs.reduce((sum, h) => sum + (Number(h.share_percent) || 0), 0);

  const handleAdd = () => {
    if (!selectedPerson) {
      setError('Seleccione una persona para agregar como heredero');
      return;
    }

    if (heirs.some((h) => h.person_id === selectedPerson.id)) {
      setError('Esta persona ya fue agregada como heredero');
      return;
    }

    const heir: HeirEntry = {
      person_id: selectedPerson.id,
      party_role: 'HEREDERO',
      relationship_to_deceased: relationship,
      heir_status: heirStatus,
      share_percent: sharePercent ? Number(sharePercent) : null,
      represented_by: representedBy || null,
      personName: `${selectedPerson.first_name || ''} ${selectedPerson.last_name || ''}`.trim() || 'Sin nombre',
      docNumber: selectedPerson.identity_document_number,
      birthDate: selectedPerson.birth_date,
    };

    onAddHeir(heir);
    setSelectedPerson(null);
    setSharePercent('');
    setRepresentedBy('');
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" />
            Herederos Iniciales (Opcional)
          </h4>
          <span className="text-[11px] font-semibold text-muted-foreground">
            Cuota acumulada: <strong className="text-foreground">{totalQuota.toFixed(2)}%</strong>
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Puede asociar los herederos conocidos ahora o registrarlos más adelante en el expediente.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Formulario de Alta Rápida de Heredero */}
      <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-3">
        <label className="text-xs font-semibold text-foreground block">
          Buscar o Crear Persona Heredera
        </label>
        <PersonPicker
          selectedPersonId={selectedPerson?.id || null}
          onSelectPerson={(p) => {
            setSelectedPerson(p);
            setError(null);
          }}
        />

        {selectedPerson && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField id="w-rel" label="Parentesco">
                <select
                  id="w-rel"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as RelationshipType)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs"
                >
                  {RELATIONSHIP_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id="w-status" label="Condición">
                <select
                  id="w-status"
                  value={heirStatus}
                  onChange={(e) => setHeirStatus(e.target.value as HeirStatus)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs"
                >
                  {HEIR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id="w-share" label="Cuota (%)">
                <input
                  id="w-share"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Ej. 25.00"
                  value={sharePercent}
                  onChange={(e) => setSharePercent(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
                />
              </FormField>
            </div>

            {isMinor(selectedPerson.birth_date) && (
              <FormField id="w-rep" label="Representado por (Tutor/Apoderado)">
                <select
                  id="w-rep"
                  value={representedBy}
                  onChange={(e) => setRepresentedBy(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs"
                >
                  <option value="">-- Sin representante --</option>
                  {heirs
                    .filter((h) => h.person_id !== selectedPerson.id)
                    .map((h) => (
                      <option key={h.person_id} value={h.person_id}>
                        {h.personName}
                      </option>
                    ))}
                </select>
              </FormField>
            )}

            <button
              type="button"
              onClick={handleAdd}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar a la Lista</span>
            </button>
          </div>
        )}
      </div>

      {/* Lista de herederos agregados */}
      {heirs.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Herederos asignados al nuevo caso ({heirs.length})
          </h5>
          {heirs.map((h) => {
            const minor = isMinor(h.birthDate);
            const age = h.birthDate ? calculateAge(h.birthDate) : null;
            return (
              <div
                key={h.person_id}
                className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{h.personName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      DNI: {h.docNumber}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                      {h.relationship_to_deceased}
                    </span>
                    {minor && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Menor ({age} a)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Condición: {h.heir_status} · Cuota:{' '}
                    <strong>{h.share_percent ? `${h.share_percent}%` : 's/d'}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveHeir(h.person_id)}
                  className="p-1 rounded text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
