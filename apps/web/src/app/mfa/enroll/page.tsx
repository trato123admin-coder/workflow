'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '../../../components/ui/FormField';
import { createClient } from '../../../lib/supabase/client';
import { ShieldAlert, KeyRound, Copy, Check, AlertCircle } from 'lucide-react';

export default function MfaEnrollPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(true);

  useEffect(() => {
    async function startEnroll() {
      try {
        const supabase = createClient();
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'WorkFlow',
        });

        if (enrollError || !data) {
          setServerError('Error al generar clave de doble factor.');
          setIsEnrolling(false);
          return;
        }

        setFactorId(data.id);
        setQrSvg(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch {
        setServerError('No fue posible conectar con el servicio.');
      } finally {
        setIsEnrolling(false);
      }
    }

    startEnroll();
  }, []);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verifyCode,
      });

      if (challengeError) {
        setError('Código incorrecto. Compruebe la hora en su dispositivo e intente de nuevo.');
        setIsLoading(false);
        return;
      }

      router.push('/users');
      router.refresh();
    } catch {
      setError('Ocurrió un error al verificar el código.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurar Doble Factor (MFA)</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Su rol requiere autenticación en dos pasos obligatoria para proteger el acceso al sistema.
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

        {isEnrolling ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Generando clave de seguridad TOTP...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Scan QR */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                1. Escanee el código QR
              </span>
              <p className="text-xs text-muted-foreground">
                Abra Google Authenticator u otra aplicación TOTP y escanee este código:
              </p>
              <div className="p-4 bg-white rounded-xl border border-border flex items-center justify-center max-w-[200px] mx-auto shadow-sm">
                {qrSvg ? (
                  <img src={qrSvg} alt="Código QR para MFA" className="w-44 h-44" />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                    Cargando QR...
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Manual Key Fallback */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                O ingrese la clave manual
              </span>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/60 border border-border">
                <code className="text-xs font-mono font-semibold text-foreground flex-1 break-all">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Copiar clave manual"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Step 3: Verify Code */}
            <form onSubmit={handleVerify} className="space-y-4 pt-2 border-t border-border">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                2. Confirme el código generado
              </span>
              <FormField
                id="verify-code"
                label="Código de 6 dígitos de la aplicación"
                error={error}
                required
              >
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full pl-9 pr-4 py-2.5 text-center text-sm font-mono tracking-widest rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </FormField>

              <button
                type="submit"
                disabled={isLoading || verifyCode.length !== 6}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
              >
                {isLoading ? 'Verificando y activando...' : 'Activar Doble Factor'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
