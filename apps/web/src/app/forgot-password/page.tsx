'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ForgotPasswordSchema } from '@workflow/shared';
import { FormField } from '../../components/ui/FormField';
import { createClient } from '../../lib/supabase/client';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const validation = ForgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Correo inválido');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setServerError('No fue posible enviar el enlace de recuperación. Inténtelo más tarde.');
        setIsLoading(false);
        return;
      }

      setIsSubmitted(true);
    } catch {
      setServerError('Ocurrió un error inesperado al conectar con el servidor.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al inicio de sesión</span>
        </Link>

        {isSubmitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Enlace Enviado</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Hemos enviado instrucciones a <span className="font-semibold text-foreground">{email}</span> para restablecer su contraseña si la cuenta existe en el sistema.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="w-full inline-block py-2.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-center"
              >
                Regresar al login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Recuperar Contraseña</h1>
              <p className="text-xs text-muted-foreground">
                Ingrese el correo electrónico asociado a su cuenta corporativa para recibir el enlace de restablecimiento.
              </p>
            </div>

            {serverError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                id="email"
                label="Correo electrónico"
                error={error}
                required
              >
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@workflow.pe"
                    className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </FormField>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
