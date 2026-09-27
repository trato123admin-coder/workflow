'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { createClient } from '../../lib/supabase/client';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { DocumentFieldsDictionary } from '../../components/templates/DocumentFieldsDictionary';
import { GoldenCaseModal } from '../../components/templates/GoldenCaseModal';
import { TemplateUploadModal } from '../../components/templates/TemplateUploadModal';
import { requestTemplateDownloadUrl } from '../../lib/engine-client';
import {
  FileCheck,
  FileCode,
  Plus,
  Sparkles,
  Download,
  Loader2,
  Clock,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { Template } from '@workflow/shared';

interface TemplateWithDocType extends Template {
  document_type?: {
    id: string;
    code: string;
    name: string;
    category: string;
  } | null;
}

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'FIELDS'>('TEMPLATES');
  const [templates, setTemplates] = useState<TemplateWithDocType[]>([]);
  const [docTypes, setDocTypes] = useState<
    Array<{ id: string; name: string; code: string; category: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isGoldenCaseOpen, setIsGoldenCaseOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const [tplRes, typesRes] = await Promise.all([
        supabase
          .from('templates')
          .select(
            `
            *,
            document_type:document_types (id, code, name, category)
          `,
          )
          .order('name', { ascending: true }),
        supabase
          .from('document_types')
          .select('id, name, code, category')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (tplRes.error) throw tplRes.error;
      if (typesRes.error) throw typesRes.error;

      setTemplates((tplRes.data as unknown as TemplateWithDocType[]) || []);
      setDocTypes(typesRes.data || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar plantillas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDownload = async (tpl: TemplateWithDocType) => {
    if (!tpl.id) return;
    setDownloadingId(tpl.id);
    try {
      const downloadUrl = await requestTemplateDownloadUrl(tpl.id);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${tpl.name}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      alert((err as Error).message || 'Error al descargar la plantilla');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Plantillas Documentales' }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              <span>Plantillas y Modelos Documentales</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Catálogo de modelos Word con inspección de marcadores, control de vigencias y casos de
              prueba.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGoldenCaseOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-input bg-card text-foreground hover:bg-muted shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Caso Dorado</span>
            </button>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Plantilla</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Selector de Pestañas */}
        <div className="flex gap-6 border-b border-border text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('TEMPLATES')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'TEMPLATES'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Plantillas Activas ({templates.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FIELDS')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'FIELDS'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Diccionario de Campos de Sustitución</span>
          </button>
        </div>

        {/* Contenido según pestaña */}
        {activeTab === 'TEMPLATES' ? (
          <div>
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs">Cargando catálogo de plantillas...</p>
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={<FileCheck className="w-8 h-8 text-muted-foreground" />}
                title="Sin plantillas registradas"
                description="Suba una primera plantilla DOCX para el llenado automatizado de expedientes."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded-xl border border-border bg-card text-card-foreground shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {tpl.document_type?.name || 'Documento'}
                        </span>
                        <h3 className="text-sm font-bold text-foreground mt-1.5">{tpl.name}</h3>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Vigencia: {tpl.valid_from}{' '}
                            {tpl.valid_until ? `al ${tpl.valid_until}` : '(Indefinida)'}
                          </span>
                        </div>
                        {tpl.estimated_manual_minutes > 0 && (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Ahorro est.: {tpl.estimated_manual_minutes} min manuales</span>
                          </div>
                        )}
                        <div className="text-[11px] font-mono text-muted-foreground">
                          Versión: {tpl.version}{' '}
                          {tpl.checksum && `(${tpl.checksum.substring(0, 8)})`}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                      <StatusBadge
                        category={tpl.is_active ? 'success' : 'neutral'}
                        label={tpl.is_active ? 'Activa' : 'Inactiva'}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleDownload(tpl)}
                        disabled={downloadingId === tpl.id}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        {downloadingId === tpl.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Descargar DOCX</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <DocumentFieldsDictionary />
        )}

        <TemplateUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={loadData}
          documentTypes={docTypes}
        />

        <GoldenCaseModal isOpen={isGoldenCaseOpen} onClose={() => setIsGoldenCaseOpen(false)} />
      </div>
    </AppShell>
  );
}
