'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, FolderGit2, Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { createClient } from '../../lib/supabase/client';
import {
  DocumentTypeCatalogTable,
  type DocumentTypeItem,
} from '../../components/documents/DocumentTypeCatalogTable';
import { CaseDocumentsLibraryTab } from '../../components/documents/CaseDocumentsLibraryTab';
import { ConfirmImpactDialog } from '../../components/ui/ConfirmImpactDialog';

interface RolePermCheck {
  roles?: {
    is_superuser?: boolean;
    is_active?: boolean;
    role_permissions?: Array<{ permissions?: { code?: string } | null }>;
  } | null;
}

export default function DocumentLibraryPage() {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'CASES'>('CATALOG');
  const [docTypes, setDocTypes] = useState<DocumentTypeItem[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canManageTypes, setCanManageTypes] = useState(false);

  const loadDocTypes = useCallback(async () => {
    setIsLoadingTypes(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('roles(is_superuser, is_active, role_permissions(permissions(code)))')
          .eq('user_id', userData.user.id);

        const roleList = (userRoles || []) as unknown as RolePermCheck[];
        const hasManage = roleList.some((ur) => {
          const r = ur.roles;
          if (!r?.is_active) return false;
          if (r.is_superuser) return true;
          return r.role_permissions?.some((rp) => rp.permissions?.code === 'templates.manage');
        });
        setCanManageTypes(Boolean(hasManage));
      }

      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setDocTypes((data as DocumentTypeItem[]) || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar catálogo de tipos de documento');
    } finally {
      setIsLoadingTypes(false);
    }
  }, []);

  useEffect(() => {
    void loadDocTypes();
  }, [loadDocTypes]);

  const [impactDialogData, setImpactDialogData] = useState<{
    isOpen: boolean;
    id: string;
    code: string;
    name: string;
    usage: {
      count: number;
      locations: string[];
      canSafelyDeactivate: boolean;
    };
  } | null>(null);

  const executeToggle = async (id: string, nextState: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('document_types')
        .update({ is_active: nextState })
        .eq('id', id);

      if (error) throw error;
      setDocTypes((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: nextState } : t)));
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cambiar estado del tipo de documento');
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    if (!current) {
      // Activando directamente
      await executeToggle(id, true);
      return;
    }

    // Desactivando -> evaluar impacto de uso
    try {
      const targetDoc = docTypes.find((t) => t.id === id);
      const supabase = createClient();
      const [slotsRes, modelsRes] = await Promise.all([
        supabase
          .from('case_documents')
          .select('id', { count: 'exact', head: true })
          .eq('document_type_id', id)
          .eq('is_active', true),
        supabase
          .from('case_model_documents')
          .select('id', { count: 'exact', head: true })
          .eq('document_type_id', id),
      ]);

      const slotCount = slotsRes.count || 0;
      const modelCount = modelsRes.count || 0;
      const totalCount = slotCount + modelCount;

      if (totalCount > 0) {
        const locations: string[] = [];
        if (slotCount > 0) locations.push(`${slotCount} slots en expedientes activos`);
        if (modelCount > 0) locations.push(`${modelCount} definiciones en modelos de caso`);

        setImpactDialogData({
          isOpen: true,
          id,
          code: targetDoc?.code || 'DOC',
          name: targetDoc?.name || 'Tipo de Documento',
          usage: {
            count: totalCount,
            locations,
            canSafelyDeactivate: true,
          },
        });
        return;
      }

      await executeToggle(id, false);
    } catch {
      await executeToggle(id, false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Inicio', href: '/cases' }, { label: 'Biblioteca Documentaria' }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Biblioteca Documentaria
          </h1>
          <p className="text-xs text-muted-foreground">
            Catálogo maestro de documentos (Mockup 6 / A.7 #7) y repositorio de expedientes.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Pestañas de Nivel Superior: Catálogo Maestro vs Documentos en Casos */}
        <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('CATALOG')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'CATALOG'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Catálogo de Tipos ({docTypes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CASES')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'CASES'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Documentos en Expedientes</span>
          </button>
        </div>

        {/* Contenido según pestaña activa */}
        {activeTab === 'CATALOG' ? (
          isLoadingTypes ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Cargando catálogo maestro de documentos…</span>
            </div>
          ) : (
            <DocumentTypeCatalogTable
              types={docTypes}
              onToggleActive={handleToggleActive}
              onReload={loadDocTypes}
              canManage={canManageTypes}
            />
          )
        ) : (
          <CaseDocumentsLibraryTab />
        )}

        {impactDialogData?.isOpen && (
          <ConfirmImpactDialog
            isOpen={impactDialogData.isOpen}
            onClose={() => setImpactDialogData(null)}
            onConfirm={() => {
              const docId = impactDialogData.id;
              setImpactDialogData(null);
              void executeToggle(docId, false);
            }}
            title="Desactivar tipo de documento"
            itemName={impactDialogData.name}
            itemCode={impactDialogData.code}
            usage={impactDialogData.usage}
            isDeactivating={true}
          />
        )}
      </div>
    </AppShell>
  );
}
