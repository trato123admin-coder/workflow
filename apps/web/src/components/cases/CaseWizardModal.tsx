'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Stepper, StepItem } from '../ui/Stepper';
import { CaseWizardStepClient } from './CaseWizardStepClient';
import { CaseWizardStepCausante } from './CaseWizardStepCausante';
import { CaseWizardStepParams } from './CaseWizardStepParams';
import { CaseWizardStepHeirs } from './CaseWizardStepHeirs';
import { CaseWizardStepAssign } from './CaseWizardStepAssign';
import { useCaseWizardData } from './useCaseWizardData';
import { createClient } from '../../lib/supabase/client';
import {
  type PersonItem,
  type CaseRoute,
  type CasePriority,
  type InitialPartyInput,
} from '@workflow/shared';
import { Briefcase, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';

interface HeirEntry extends InitialPartyInput {
  personName: string;
  docNumber: string;
  birthDate?: string | null;
}

interface CaseWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (caseId: string) => void;
}

const STEP_ITEMS: StepItem[] = [
  { id: 'client', title: 'Cliente', description: 'Contratante' },
  { id: 'causante', title: 'Causante', description: 'Fallecido' },
  { id: 'model', title: 'Modelo', description: 'Trámite' },
  { id: 'heirs', title: 'Herederos', description: 'Opcional' },
  { id: 'assign', title: 'Asignación', description: 'Responsable' },
];

export const CaseWizardModal: React.FC<CaseWizardModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Wizard data hook
  const {
    models,
    selectedModelVersionId,
    setSelectedModelVersionId,
    users,
    responsibleId,
    setResponsibleId,
  } = useCaseWizardData(isOpen);

  // Step 1: Contratante
  const [selectedClient, setSelectedClient] = useState<PersonItem | null>(null);

  // Step 2: Causante
  const [selectedCausante, setSelectedCausante] = useState<PersonItem | null>(null);
  const [deathDate, setDeathDate] = useState('');

  // Step 3: Modelo y Parámetros
  const [title, setTitle] = useState('');
  const [route, setRoute] = useState<CaseRoute>('POR_DEFINIR');
  const [priority, setPriority] = useState<CasePriority>('NORMAL');
  const [isConfidential, setIsConfidential] = useState(false);

  // Step 4: Herederos
  const [heirs, setHeirs] = useState<HeirEntry[]>([]);

  // Step 5: Asignación
  const [lawyerId, setLawyerId] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const handleSelectClient = (p: PersonItem) => {
    setSelectedClient(p);
    const clientName =
      p.person_type === 'JURIDICA'
        ? p.legal_name || ''
        : `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (!title || title.startsWith('Sucesión Intestada')) {
      setTitle(`Sucesión Intestada - ${clientName}`);
    }
  };

  const handleNext = () => {
    setErrors({});
    if (currentStep === 0) {
      if (!selectedClient) {
        setErrors({ client: 'Debe seleccionar un contratante antes de continuar' });
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!selectedCausante) {
        setErrors({ causante: 'Debe seleccionar al causante del proceso sucesorio' });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!title.trim() || title.trim().length < 3) {
        setErrors({ title: 'El título debe tener al menos 3 caracteres' });
        return;
      }
      if (!selectedModelVersionId) {
        setErrors({ model: 'Debe seleccionar un modelo de caso' });
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClient || !selectedModelVersionId || !title.trim()) {
      setGeneralError('Faltan datos obligatorios para crear el expediente');
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');

    try {
      const supabase = createClient();

      if (selectedCausante && deathDate) {
        await supabase
          .from('persons')
          .update({ death_date: deathDate, is_deceased: true })
          .eq('id', selectedCausante.id);
      }

      const initialPartiesPayload = heirs.map((h) => ({
        person_id: h.person_id,
        party_role: h.party_role,
        relationship_to_deceased: h.relationship_to_deceased,
        heir_status: h.heir_status,
        share_percent: h.share_percent,
        represented_by: h.represented_by,
      }));

      const { data: newCaseId, error: rpcError } = await supabase.rpc('create_case_from_model', {
        _model_version_id: selectedModelVersionId,
        _client_person_id: selectedClient.id,
        _title: title.trim(),
        _description: null,
        _route: route,
        _has_dispute: false,
        _priority: priority,
        _is_confidential: isConfidential,
        _ai_allowed: true,
        _responsible_id: responsibleId || null,
        _lawyer_id: lawyerId || null,
        _collaborator_ids: [],
        _causante_person_id: selectedCausante?.id || null,
        _initial_parties: initialPartiesPayload,
      });

      if (rpcError) throw rpcError;
      if (!newCaseId) throw new Error('No se recibió el identificador del caso creado');

      onCaseCreated(newCaseId as string);
    } catch (err: unknown) {
      setGeneralError((err as Error).message || 'Error al crear expediente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Expediente Sucesorio"
      maxWidth="xl"
    >
      <div className="space-y-6">
        <Stepper steps={STEP_ITEMS} currentStep={currentStep} onStepClick={(s) => s < currentStep && setCurrentStep(s)} />

        {generalError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Paso 1: Contratante */}
        {currentStep === 0 && (
          <CaseWizardStepClient
            selectedClient={selectedClient}
            onSelectClient={handleSelectClient}
            error={errors.client}
          />
        )}

        {/* Paso 2: Causante */}
        {currentStep === 1 && (
          <CaseWizardStepCausante
            selectedCausante={selectedCausante}
            onSelectCausante={(c) => setSelectedCausante(c)}
            deathDate={deathDate}
            onDeathDateChange={(d) => setDeathDate(d)}
            error={errors.causante}
          />
        )}

        {/* Paso 3: Modelo y Parámetros */}
        {currentStep === 2 && (
          <CaseWizardStepParams
            models={models}
            selectedModelVersionId={selectedModelVersionId}
            onModelVersionChange={setSelectedModelVersionId}
            title={title}
            onTitleChange={setTitle}
            route={route}
            onRouteChange={setRoute}
            priority={priority}
            onPriorityChange={setPriority}
            isConfidential={isConfidential}
            onConfidentialChange={setIsConfidential}
            errors={errors}
          />
        )}

        {/* Paso 4: Herederos Opcionales */}
        {currentStep === 3 && (
          <CaseWizardStepHeirs
            heirs={heirs}
            onAddHeir={(h) => setHeirs((prev) => [...prev, h])}
            onRemoveHeir={(id) => setHeirs((prev) => prev.filter((h) => h.person_id !== id))}
            availablePersons={[]}
          />
        )}

        {/* Paso 5: Asignación */}
        {currentStep === 4 && (
          <CaseWizardStepAssign
            users={users}
            responsibleId={responsibleId}
            onResponsibleChange={setResponsibleId}
            lawyerId={lawyerId}
            onLawyerChange={setLawyerId}
            selectedPerson={selectedClient}
            title={title}
            errors={errors}
          />
        )}

        {/* Botones de navegación */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {currentStep > 0 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
            >
              <span>{currentStep === 3 ? 'Continuar a Asignación' : 'Siguiente'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              <Briefcase className="w-4 h-4" />
              <span>{isSubmitting ? 'Creando expediente...' : 'Crear Expediente'}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
