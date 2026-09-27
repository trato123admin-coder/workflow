'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { DocumentFieldsDictionary } from '../../../components/templates/DocumentFieldsDictionary';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TemplateFieldsPage() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Inicio', href: '/dashboard' },
        { label: 'Plantillas Documentales', href: '/templates' },
        { label: 'Diccionario de Campos' },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="p-1.5 rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Diccionario de Campos de Sustitución
            </h1>
            <p className="text-xs text-muted-foreground">
              Variables y marcadores admitidos por el motor de generación documental.
            </p>
          </div>
        </div>

        <DocumentFieldsDictionary />
      </div>
    </AppShell>
  );
}
