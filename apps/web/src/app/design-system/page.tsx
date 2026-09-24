'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { KpiCard } from '../../components/ui/KpiCard';
import { Tabs } from '../../components/ui/Tabs';
import { Stepper } from '../../components/ui/Stepper';
import { FormField } from '../../components/ui/FormField';
import { DataTable, Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import {
  Briefcase,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Palette,
} from 'lucide-react';

interface SampleItem {
  id: string;
  name: string;
  role: string;
  status: 'Activo' | 'Inactivo' | 'En trámite';
  category: 'success' | 'danger' | 'info';
}

const SAMPLE_DATA: SampleItem[] = [
  { id: '1', name: 'Carlos Rodríguez', role: 'Gestor Principal', status: 'Activo', category: 'success' },
  { id: '2', name: 'Dra. María Ramos', role: 'Abogado Revisor', status: 'Activo', category: 'success' },
  { id: '3', name: 'Juan Alarcón', role: 'Consulta', status: 'Inactivo', category: 'danger' },
  { id: '4', name: 'Lucía Benítez', role: 'Caja Chica', status: 'En trámite', category: 'info' },
];

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState('components');
  const [activeStep, setActiveStep] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sampleText, setSampleText] = useState('');
  const [sampleError, setSampleError] = useState('');

  const sampleColumns: Column<SampleItem>[] = [
    { id: 'name', header: 'Nombre', accessorKey: 'name', sortable: true },
    { id: 'role', header: 'Rol asignado', accessorKey: 'role', sortable: true },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) => <StatusBadge category={item.category} label={item.status} />,
    },
  ];

  return (
    <AppShell
      userName="Admin Diseño"
      userRole="Superusuario"
      userEmail="admin@docuai.pe"
      isSuperuser={true}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Palette className="w-6 h-6 text-primary" />
              <span>Sistema de Diseño (DocuAI Tokens)</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Catálogo de componentes reutilizables, tokens CSS de A.2 y estados accesibles (es-PE).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Probar Modal</span>
          </button>
        </div>

        {/* Tab switch */}
        <Tabs
          tabs={[
            { id: 'components', label: 'Componentes Base', count: 8 },
            { id: 'tokens', label: 'Tokens y Colores' },
            { id: 'typography', label: 'Tipografía y Estilos' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'components' && (
          <div className="space-y-8">
            {/* Section: Status Badges */}
            <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-foreground">Insignias de Estado (StatusBadge con Icono + Texto)</h2>
              <p className="text-xs text-muted-foreground">
                Cumplen la regla de accesibilidad AA (no dependen únicamente del color):
              </p>
              <div className="flex flex-wrap gap-2.5 pt-2">
                <StatusBadge category="success" label="Finalizado / Activo" />
                <StatusBadge category="warning" label="En proceso / Alerta" />
                <StatusBadge category="danger" label="Vencido / Error / Inactivo" />
                <StatusBadge category="info" label="En trámite / Sistema" />
                <StatusBadge category="waiting" label="En espera" />
                <StatusBadge category="neutral" label="Pendiente / Sin iniciar" />
              </div>
            </section>

            {/* Section: KPI Cards */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-foreground">Tarjetas de Métricas (KpiCard)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="Total de Casos"
                  value="128"
                  icon={<Briefcase className="w-5 h-5" />}
                  change={{ value: '+14%', trend: 'up', label: 'vs. mes anterior' }}
                />
                <KpiCard
                  title="En Proceso"
                  value="42"
                  icon={<Users className="w-5 h-5" />}
                  change={{ value: '+5%', trend: 'up', label: 'vs. mes anterior' }}
                />
                <KpiCard
                  title="Finalizados"
                  value="79"
                  icon={<CheckCircle2 className="w-5 h-5" />}
                  change={{ value: '+22%', trend: 'up', label: 'vs. mes anterior' }}
                />
                <KpiCard
                  title="Vencidos / Observados"
                  value="7"
                  icon={<AlertCircle className="w-5 h-5" />}
                  change={{ value: '-3%', trend: 'down', label: 'vs. mes anterior' }}
                />
              </div>
            </section>

            {/* Section: Stepper */}
            <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-foreground">Asistente por Pasos (Stepper)</h2>
              <Stepper
                steps={[
                  { id: 1, title: 'Identificación', description: 'Datos del causante' },
                  { id: 2, title: 'Intervinientes', description: 'Herederos y cuotas' },
                  { id: 3, title: 'Bienes', description: 'Inventario activo' },
                  { id: 4, title: 'Trámites', description: 'Notaría y SUNARP' },
                  { id: 5, title: 'Finalización', description: 'Revisión y cierre' },
                ]}
                currentStep={activeStep}
                onStepClick={setActiveStep}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background hover:bg-muted"
                >
                  Paso anterior
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep((s) => Math.min(4, s + 1))}
                  className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Paso siguiente
                </button>
              </div>
            </section>

            {/* Section: FormField */}
            <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 max-w-xl">
              <h2 className="text-sm font-bold text-foreground">Campos de Formulario Accesibles (FormField)</h2>
              <FormField
                id="sample-input"
                label="Nombre del solicitante"
                description="Ingrese el nombre completo tal como figura en el DNI."
                error={sampleError}
                required
              >
                <input
                  id="sample-input"
                  type="text"
                  value={sampleText}
                  onChange={(e) => {
                    setSampleText(e.target.value);
                    if (e.target.value.length < 3) {
                      setSampleError('El nombre debe tener al menos 3 caracteres');
                    } else {
                      setSampleError('');
                    }
                  }}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </FormField>
            </section>

            {/* Section: DataTable */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-foreground">Tabla de Datos Responsiva (DataTable)</h2>
              <DataTable
                data={SAMPLE_DATA}
                columns={sampleColumns}
                keyExtractor={(item) => item.id}
                searchFilter={(item, q) =>
                  item.name.toLowerCase().includes(q.toLowerCase()) ||
                  item.role.toLowerCase().includes(q.toLowerCase())
                }
              />
            </section>

            {/* Section: EmptyState and Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-foreground">Estado Vacío (EmptyState)</h2>
                <EmptyState
                  title="No hay trámites pendientes"
                  description="Todos los documentos han sido revisados y procesados."
                  action={
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground"
                    >
                      Crear nuevo trámite
                    </button>
                  }
                />
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-foreground">Esqueleto de Carga (Skeleton)</h2>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-foreground">Tokens de Color del Sistema</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-primary text-primary-foreground flex flex-col justify-between h-24">
                <span className="font-semibold">Primary</span>
                <span className="opacity-80">--primary</span>
              </div>
              <div className="p-4 rounded-xl bg-sidebar text-sidebar-foreground flex flex-col justify-between h-24 border border-sidebar-border">
                <span className="font-semibold">Sidebar Navy</span>
                <span className="opacity-80">--sidebar-background</span>
              </div>
              <div className="p-4 rounded-xl bg-card text-card-foreground flex flex-col justify-between h-24 border border-border">
                <span className="font-semibold">Card Surface</span>
                <span className="opacity-80">--card</span>
              </div>
              <div className="p-4 rounded-xl bg-destructive text-destructive-foreground flex flex-col justify-between h-24">
                <span className="font-semibold">Destructive</span>
                <span className="opacity-80">--destructive</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal demo */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Ventana de Confirmación"
          description="Este diálogo demuestra el comportamiento accesible de la ventana modal."
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Aceptar
              </button>
            </>
          }
        >
          <p className="text-xs text-foreground">
            Los modales capturan el foco y responden a la tecla Escape para cumplir las pautas de accesibilidad WCAG AA.
          </p>
        </Modal>
      </div>
    </AppShell>
  );
}
