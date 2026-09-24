import React from 'react';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  id: string;
  label?: string;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  error,
  description,
  required,
  className,
  children,
}) => {
  return (
    <div className={cn('space-y-1.5 text-left', className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-foreground tracking-wide"
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      {children}

      {description && !error && (
        <p id={`${id}-desc`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
