'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResetPasswordSchema } from '@workflow/shared';
import { FormField } from '../../components/ui/FormField';
import { createClient } from '../../lib/supabase/client';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const validation = ResetPasswordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'password') fieldErrors.password = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setServerError('No fue posible actualizar la contraseña. El enlace puede haber expirado.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch {
      setServerError('Ocurrió un error inesperado al conectar con el servidor.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
        {isSuccess ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Contraseña Actualizada</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Su contraseña ha sido modificada con éxito. Redirigiendo a la pantalla de inicio de sesión...
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Nueva Contraseña</h1>
              <p className="text-xs text-muted-foreground">
                Establezca una contraseña segura con al menos 8 caracteres, una mayúscula y un número.
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
                id="password"
                label="Nueva contraseña"
                error={errors.password}
                required
              >
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </FormField>

              <FormField
                id="confirmPassword"
                label="Confirmar nueva contraseña"
                error={errors.confirmPassword}
                required
              >
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </FormField>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? 'Actualizando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
