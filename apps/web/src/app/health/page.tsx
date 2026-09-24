'use client';

import { useTranslations } from 'next-intl';
import { Activity, CheckCircle2, Server, Database, Globe } from 'lucide-react';

export default function HealthPage() {
  const t = useTranslations('health');
  const tc = useTranslations('common');

  return (
    <main className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('allSystemsOperational')}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">{t('subtitle')}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Web App */}
          <div className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-sm md:text-base">{t('webStatus')}</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {tc('healthy')}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <div className="flex justify-between">
                <span>{tc('environment')}:</span>
                <span className="font-mono text-foreground">Next.js App Router</span>
              </div>
              <div className="flex justify-between">
                <span>{t('locale')}:</span>
                <span className="font-mono text-foreground">es-PE</span>
              </div>
            </div>
          </div>

          {/* Card 2: Engine Service */}
          <div className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-sm md:text-base">{t('engineStatus')}</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {tc('healthy')}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <div className="flex justify-between">
                <span>Endpoints:</span>
                <span className="font-mono text-foreground">/healthz, /readyz</span>
              </div>
              <div className="flex justify-between">
                <span>Runtime:</span>
                <span className="font-mono text-foreground">Fastify / Node 22</span>
              </div>
            </div>
          </div>

          {/* Card 3: Supabase Database */}
          <div className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-sm md:text-base">{t('databaseStatus')}</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {tc('healthy')}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <div className="flex justify-between">
                <span>Seguridad:</span>
                <span className="font-mono text-foreground">RLS 100% activa</span>
              </div>
              <div className="flex justify-between">
                <span>Auditoría:</span>
                <span className="font-mono text-foreground">Append-only</span>
              </div>
            </div>
          </div>

          {/* Card 4: Domain & Defaults */}
          <div className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-sm md:text-base">Parámetros del Dominio</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                Sprint 0
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <div className="flex justify-between">
                <span>{t('timezone')}:</span>
                <span className="font-mono text-foreground">America/Lima</span>
              </div>
              <div className="flex justify-between">
                <span>Moneda:</span>
                <span className="font-mono text-foreground">PEN (S/.)</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-muted-foreground">
          {tc('appName')} · Sprint 0 — Fundaciones
        </footer>
      </div>
    </main>
  );
}
