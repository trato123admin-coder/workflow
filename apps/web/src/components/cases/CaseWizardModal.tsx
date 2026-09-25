'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Stepper, StepItem } from '../ui/Stepper';
import { PersonPicker } from '../persons/PersonPicker';
import { CaseWizardStepParams } from './CaseWizardStepParams';
import { CaseWizardStepAssign } from './CaseWizardStepAssign';
import { createClient } from '../../lib/supabase/client';
import {
  CreateCaseWizardSchema,
  type PersonItem,
  type CaseRoute,
  type CasePriority,
} from '@workflow/shared';
import { Briefcase, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';

interface CaseWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (caseId: string) => void;
}

export const CaseWizardModal: React.FC<CaseWizardModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [models, setModels] = useState<
    { version_id: string; code: string; name: string; version: number }[]
  >([]);
  const [selectedModelVersionId, setSelectedModelVersionId] = useState('');
  const [title, setTitle] = useState('');
  const [route, setRoute] = useState<CaseRoute>('POR_DEFINIR');
  const [priority, setPriority] = useState<CasePriority>('NORMAL');
  const [isConfidential, setIsConfidential] = useState(false);
  const [users, setUsers] = useState<{ id: string; email: string; name: string; role: string }[]>(
    [],
  );
  const [responsibleId, setResponsibleId] = useState('');
  const [lawyerId, setLawyerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const loadWizardData = async () => {
      try {
        const supabase = createClient();
        const { data: vData } = await supabase
          .from('case_model_versions')
          .select(`id, version, case_models ( code, name )`)
          .eq('status', 'PUBLISHED');

        if (vData) {
          const formatted = (
            vData as unknown as {
              id: string;
              version: number;
              case_models: { code: string; name: string } | null;
            }[]
          ).map((v) => ({
            version_id: v.id,
            code: v.case_models?.code || '',
            name: v.case_models?.name || '',
            version: v.version,
          }));
          setModels(formatted);
          const notarial =
            formatted.find((m) => m.code === 'SUCESION_INTESTADA_NOTARIAL') || formatted[0];
          if (notarial) setSelectedModelVersionId(notarial.version_id);
        }

        const { data: uData } = await supabase
          .from('profiles')
          .select(`id, email, first_name, last_name, user_roles!user_id ( roles ( code, name ) )`)
          .eq('is_active', true);

        if (uData) {
          const formattedUsers = (
            uData as unknown as {
              id: string;
              email: string;
              first_name: string | null;
              last_name: string | null;
              user_roles: { roles: { code: string; name: string } | null }[] | null;
            }[]
          ).map((u) => ({
            id: u.id,
            email: u.email,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
            role: u.user_roles?.[0]?.roles?.name || 'Usuario',
          }));
          setUsers(formattedUsers);

          const { data: sessionData } = await supabase.auth.getSession();
          const currentUserId = sessionData.session?.user?.id;
          if (currentUserId) {
            setResponsibleId(currentUserId);
          } else if (formattedUsers.length > 0 && formattedUsers[0]) {
            setResponsibleId(formattedUsers[0].id);
          }
        }
      } catch (err) {
        // Fallback
      }
    };

    loadWizardData();
  }, [isOpen]);

  const handleSelectPerson = (p: PersonItem) => {
    setSelectedPerson(p);
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
      if (!selectedPerson) {
        setErrors({ client: 'Debe seleccionar un cliente antes de continuar' });
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!title.trim() || title.trim().length < 3) {
        setErrors({ title: 'El título debe tener al menos 3 caracteres' });
        return;
      }
      if (!selectedModelVersionId) {
        setErrors({ model: 'Debe seleccionar un modelo de caso' });
        return;
      }
      setCurrentStep(2);
    }
  };

  const handleCreateCase = async () => {
    setErrors({});
    setGeneralError('');
    if (!responsibleId) {
      setErrors({ responsible: 'Debe seleccionar un gestor responsable' });
      return;
    }

    const payload = {
      client_person_id: selectedPerson?.id,
      case_model_version_id: selectedModelVersionId,
      title: title.trim(),
      route,
      priority,
      is_confidential: isConfidential,
      responsible_id: responsibleId,
      lawyer_id: lawyerId || null,
      collaborator_ids: [],
    };

    const validation = CreateCaseWizardSchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: newCaseId, error } = await supabase.rpc('create_case_from_model', {
        _model_version_id: payload.case_model_version_id,
        _client_person_id: payload.client_person_id,
        _title: payload.title,
        _route: payload.route,
        _priority: payload.priority,
        _is_confidential: payload.is_confidential,
        _responsible_id: payload.responsible_id,
        _lawyer_id: payload.lawyer_id || null,
      });

      if (error) throw error;
      onCaseCreated(newCaseId);
      onClose();
    } catch (err: unknown) {
      setGeneralError((err as Error).message || 'Error al crear el caso desde el modelo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: StepItem[] = [
    { id: 'step-1', title: 'Contratante', description: 'Selección de cliente' },
    { id: 'step-2', title: 'Modelo y Caso', description: 'Parámetros del trámite' },
    { id: 'step-3', title: 'Asignación', description: 'Equipo y confirmación' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asistente de Creación de Caso" maxWidth="lg">
      <div className="space-y-6">
        <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />

        {generalError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Paso 1: Seleccione al cliente contratante
              </h3>
            </div>
            {errors.client && (
              <p className="text-xs text-destructive font-medium">{errors.client}</p>
            )}
            <PersonPicker
              selectedPersonId={selectedPerson?.id || null}
              onSelectPerson={handleSelectPerson}
            />
          </div>
        )}

        {currentStep === 1 && (
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

        {currentStep === 2 && (
          <CaseWizardStepAssign
            users={users}
            responsibleId={responsibleId}
            onResponsibleChange={setResponsibleId}
            lawyerId={lawyerId}
            onLawyerChange={setLawyerId}
            selectedPerson={selectedPerson}
            title={title}
            errors={errors}
          />
        )}

        <div className="flex justify-between pt-4 border-t border-border">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs hover:bg-muted"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateCase}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
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
