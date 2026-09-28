'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { Stepper, type StepItem } from '../../components/ui/Stepper';
import { CaseSelectorStep } from '../../components/assistant/CaseSelectorStep';
import { RecommendationCard } from '../../components/assistant/RecommendationCard';
import { MissingFieldsForm } from '../../components/assistant/MissingFieldsForm';
import { DocumentPreviewStep } from '../../components/assistant/DocumentPreviewStep';
import { GenerateStep } from '../../components/assistant/GenerateStep';
import { useAssistantEvaluation } from '../../components/assistant/useAssistantEvaluation';
import { updateRecommendationDecision } from '../../lib/recommendations-stats';
import type { CaseOption, EvaluatedCandidate } from '../../components/assistant/types';
import { Sparkles, Scale, AlertCircle, Loader2, FileQuestion } from 'lucide-react';

const ASSISTANT_STEPS: StepItem[] = [
  { id: 0, title: 'Expediente', description: 'Selección de caso' },
  { id: 1, title: 'Recomendación', description: 'Reglas y sugerencia' },
  { id: 2, title: 'Datos', description: 'Completar variables' },
  { id: 3, title: 'Vista previa', description: 'Borrador preliminar' },
  { id: 4, title: 'Generar', description: 'Aprobación final' },
];

function AssistantContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get('caseId');

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);

  const {
    isEvaluating,
    evaluationError,
    candidates,
    selectedCandidate,
    setSelectedCandidate,
    evaluateCase,
  } = useAssistantEvaluation(supabase);

  // Load cases accessible to user
  useEffect(() => {
    async function loadCases() {
      setIsLoadingCases(true);
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('id, case_number, title, case_model_version_id, process_type, created_at')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setCases(data || []);
      } catch (err: unknown) {
        // Handled silently or empty state displayed
      } finally {
        setIsLoadingCases(false);
      }
    }
    loadCases();
  }, [supabase]);

  // If initial caseId was in query param, trigger evaluation
  useEffect(() => {
    if (initialCaseId && !selectedCandidate && !isEvaluating) {
      setSelectedCaseId(initialCaseId);
      evaluateCase(initialCaseId).then(() => {
        setCurrentStep(1);
      });
    }
  }, [initialCaseId, evaluateCase, selectedCandidate, isEvaluating]);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  const handleStartEvaluation = async () => {
    if (!selectedCaseId) return;
    await evaluateCase(selectedCaseId);
    setCurrentStep(1);
  };

  const handleAcceptCandidate = (candidate: EvaluatedCandidate) => {
    setSelectedCandidate(candidate);
    setCurrentStep(2);
  };

  const handleDismissCandidate = async (candidate: EvaluatedCandidate) => {
    if (!candidate.recommendationId) return;
    setIsProcessingDecision(true);
    try {
      await updateRecommendationDecision(supabase, candidate.recommendationId, false);
      // Select next alternative if available
      const remaining = candidates.filter((c) => c.documentTypeId !== candidate.documentTypeId);
      if (remaining.length > 0) {
        setSelectedCandidate(remaining[0]);
      } else {
        setSelectedCandidate(null);
      }
    } finally {
      setIsProcessingDecision(false);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!selectedCandidate?.recommendationId) return;
    setIsProcessingDecision(true);
    try {
      // 1. Mark selected candidate as was_accepted = true
      await updateRecommendationDecision(supabase, selectedCandidate.recommendationId, true);

      // 2. Mark unselected alternatives from this session as was_accepted = false.
      // Decision rationale: The user was shown these candidates and chose a different one.
      // Recording them as not accepted reflects realistic conversion rates for Laplace smoothing.
      const otherCandidates = candidates.filter(
        (c) => c.documentTypeId !== selectedCandidate.documentTypeId && c.recommendationId
      );
      await Promise.all(
        otherCandidates.map((c) =>
          updateRecommendationDecision(supabase, c.recommendationId!, false)
        )
      );
    } finally {
      setIsProcessingDecision(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setSelectedCaseId(null);
    setFieldValues({});
  };

  const alternatives = candidates.filter(
    (c) => c.documentTypeId !== selectedCandidate?.documentTypeId
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Asistente de Documentos</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Sugerencia y preparación de documentos basada en reglas deterministas y métricas históricas.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground shrink-0">
          <Scale className="w-4 h-4 text-primary" />
          <span>Modo: Solo Reglas (Determinista)</span>
        </div>
      </div>

      {/* 5-Step Stepper */}
      <Stepper
        steps={ASSISTANT_STEPS}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step < currentStep) setCurrentStep(step);
        }}
      />

      {/* Step Contents */}
      {currentStep === 0 && (
        <CaseSelectorStep
          cases={cases}
          isLoading={isLoadingCases}
          selectedCaseId={selectedCaseId}
          onSelectCase={(id) => setSelectedCaseId(id)}
          onContinue={handleStartEvaluation}
        />
      )}

      {currentStep === 1 && (
        <>
          {isEvaluating ? (
            <div className="p-12 text-center space-y-3 border border-dashed border-border rounded-2xl">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Evaluando reglas deterministas para el expediente...
              </p>
              <p className="text-xs text-muted-foreground">
                Consultando condiciones legales, completitud y tasa histórica de aceptación.
              </p>
            </div>
          ) : evaluationError ? (
            <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Error en la evaluación de reglas</span>
              </div>
              <p className="text-xs">{evaluationError}</p>
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Volver a seleccionar caso
              </button>
            </div>
          ) : !selectedCandidate ? (
            <div className="p-12 text-center space-y-3 border border-dashed border-border rounded-2xl">
              <FileQuestion className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="text-sm font-semibold text-foreground">
                No hay documentos requeridos ni recomendados
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Las reglas vigentes para este modelo de caso no activaron ninguna recomendación para
                el estado y condiciones actuales del expediente.
              </p>
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
              >
                Seleccionar otro expediente
              </button>
            </div>
          ) : (
            <RecommendationCard
              topCandidate={selectedCandidate}
              alternatives={alternatives}
              onAccept={handleAcceptCandidate}
              onDismiss={handleDismissCandidate}
              onSelectAlternative={(alt) => setSelectedCandidate(alt)}
              onBackToCase={() => setCurrentStep(0)}
              isProcessingDecision={isProcessingDecision}
            />
          )}
        </>
      )}

      {currentStep === 2 && selectedCandidate && (
        <MissingFieldsForm
          candidate={selectedCandidate}
          fieldValues={fieldValues}
          onFieldValuesChange={setFieldValues}
          onBack={() => setCurrentStep(1)}
          onContinue={() => setCurrentStep(3)}
        />
      )}

      {currentStep === 3 && selectedCandidate && (
        <DocumentPreviewStep
          candidate={selectedCandidate}
          fieldValues={fieldValues}
          caseNumber={selectedCase?.case_number || 'N/A'}
          onBack={() => setCurrentStep(2)}
          onContinue={() => setCurrentStep(4)}
        />
      )}

      {currentStep === 4 && selectedCandidate && (
        <GenerateStep
          candidate={selectedCandidate}
          caseId={selectedCaseId || ''}
          caseNumber={selectedCase?.case_number || 'N/A'}
          onConfirmGenerate={handleConfirmGenerate}
          onReset={handleReset}
          onBack={() => setCurrentStep(3)}
        />
      )}
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-muted-foreground">
          Cargando asistente...
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}
