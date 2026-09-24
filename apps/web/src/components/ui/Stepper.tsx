import React from 'react';
import { cn } from '../../lib/utils';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string | number;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStep: number; // 0-indexed
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, onStepClick, className }) => {
  return (
    <nav aria-label="Progreso del asistente" className={cn('w-full', className)}>
      <ol className="flex items-center w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && isCompleted;

          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center relative',
                index !== steps.length - 1 ? 'flex-1' : '',
              )}
            >
              <div
                onClick={() => isClickable && onStepClick(index)}
                className={cn(
                  'flex items-center gap-2.5 group focus:outline-none',
                  isClickable ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors shrink-0',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent && 'border-2 border-primary text-primary bg-background',
                    !isCompleted &&
                      !isCurrent &&
                      'border border-border text-muted-foreground bg-muted/40',
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : index + 1}
                </div>

                <div className="hidden sm:block text-left">
                  <p
                    className={cn(
                      'text-xs font-semibold leading-tight',
                      isCurrent
                        ? 'text-primary'
                        : isCompleted
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {index !== steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-3 transition-colors',
                    index < currentStep ? 'bg-primary' : 'bg-border',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
