'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MfaVerifySchema } from '@workflow/shared';
import { FormField } from '../../../components/ui/FormField';
import { createClient } from '../../../lib/supabase/client';
import { ShieldCheck, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function loadFactors() {
      try {
        const supabase = createClient();
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

        if (factorsError || !factorsData) {
          setServerError('Error al cargar factores de autenticación');
          setIsInitializing(false);
          return;
        }

        const totpFactor = factorsData.totp.find((f) => f.status === 'verified');
        if (!totpFactor) {
          // If no verified factor, redirect to enroll
          router.push('/mfa/enroll');
          return;
        }

        setFactorId(totpFactor.id);
      } catch {
        setServerError('No fue posible conectar con el servicio de autenticación');
      } finally {
        setIsInitializing(false);
      }
    }

    loadFactors();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const validation = MfaVerifySchema.safeParse({ code });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Código inválido');
      return;
    }

    if (!factorId) {
      setServerError('No se encontró un factor TOTP activo.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });

      if (verifyError) {
        setServerError(
          'Código incorrecto o expirado. Ingrese el código actual de su app autenticadora.',
        );
        setIsLoading(false);
        return;
      }

      router.push('/users');
      router.refresh();
    } catch {
      setServerError('Ocurrió un error inesperado al validar el código.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Verificación en Dos Pasos
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Abra su aplicación de autenticación (Google Authenticator, Microsoft Authenticator o
            similar) e ingrese el código de 6 dígitos.
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

        {isInitializing ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Verificando configuración de seguridad...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField
              id="totp-code"
              label="Código de seguridad (6 dígitos)"
              error={error}
              required
            >
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 text-center text-lg font-mono tracking-widest rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </FormField>

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                'Verificando código...'
              ) : (
                <>
                  <span>Confirmar e ingresar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
