'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Sparkles, Copy, Check, Info } from 'lucide-react';

interface GoldenCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GoldenFieldSample {
  placeholder: string;
  label: string;
  goldenValue: string;
  category: string;
}

const GOLDEN_CASE_DATA: GoldenFieldSample[] = [
  // Caso
  {
    placeholder: '{{case.number}}',
    label: 'N.º de Expediente',
    goldenValue: 'CASO-2026-0042',
    category: 'Caso',
  },
  {
    placeholder: '{{case.title}}',
    label: 'Carátula del Caso',
    goldenValue: 'Sucesión Intestada de Roberto Morales Soto',
    category: 'Caso',
  },
  {
    placeholder: '{{case.current_date}}',
    label: 'Fecha Actual Formal',
    goldenValue: '26 de septiembre de 2026',
    category: 'Caso',
  },

  // Causante
  {
    placeholder: '{{parties.causante.full_name}}',
    label: 'Nombre Completo del Causante',
    goldenValue: 'Roberto Morales Soto',
    category: 'Causante',
  },
  {
    placeholder: '{{parties.causante.dni}}',
    label: 'DNI del Causante',
    goldenValue: '09482716',
    category: 'Causante',
  },
  {
    placeholder: '{{parties.causante.death_date}}',
    label: 'Fecha de Fallecimiento',
    goldenValue: '12 de marzo de 2025',
    category: 'Causante',
  },
  {
    placeholder: '{{parties.causante.death_place}}',
    label: 'Lugar de Fallecimiento',
    goldenValue: 'Distrito de Miraflores, Provincia y Departamento de Lima',
    category: 'Causante',
  },
  {
    placeholder: '{{parties.causante.marital_status}}',
    label: 'Estado Civil al Fallecer',
    goldenValue: 'Casado',
    category: 'Causante',
  },

  // Cliente / Solicitante
  {
    placeholder: '{{client.full_name}}',
    label: 'Nombre del Solicitante',
    goldenValue: 'Carmen Rosa Benavides Vda. de Morales',
    category: 'Solicitante',
  },
  {
    placeholder: '{{client.dni}}',
    label: 'DNI del Solicitante',
    goldenValue: '08291048',
    category: 'Solicitante',
  },
  {
    placeholder: '{{client.address}}',
    label: 'Dirección Domiciliaria',
    goldenValue: 'Calle Los Pinos 340, Dpto 402, Miraflores, Lima',
    category: 'Solicitante',
  },

  // Herederos declarados
  {
    placeholder: '{{parties.heirs_list}}',
    label: 'Relación de Herederos Forzosos',
    goldenValue:
      '1. Carmen Rosa Benavides (Cónyuge supérstite, DNI 08291048)\n2. Carlos Morales Benavides (Hijo, DNI 45102938)\n3. Lucía Morales Benavides (Hija, DNI 47291039)',
    category: 'Herederos',
  },

  // Patrimonio
  {
    placeholder: '{{estate.real_estate_summary}}',
    label: 'Bienes Inmuebles Inventariados',
    goldenValue:
      'Inmueble ubicado en Calle Los Pinos 340, Miraflores, inscrito en la Partida Electrónica N.º 11029384 del Registro de Propiedad Inmueble de Lima.',
    category: 'Patrimonio',
  },
  {
    placeholder: '{{estate.vehicles_summary}}',
    label: 'Vehículos Inventariados',
    goldenValue:
      'Automóvil Marca Toyota, Modelo Corolla, Placa ABC-123, inscrito en la Partida N.º 52019283 del Registro Vehicular de Lima.',
    category: 'Patrimonio',
  },
  {
    placeholder: '{{estate.total_estimated_value_pen}}',
    label: 'Valor Total Estimado (PEN)',
    goldenValue: 'S/ 850,000.00',
    category: 'Patrimonio',
  },
];

export const GoldenCaseModal: React.FC<GoldenCaseModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const categories = ['ALL', 'Caso', 'Causante', 'Solicitante', 'Herederos', 'Patrimonio'];

  const filteredData =
    activeCategory === 'ALL'
      ? GOLDEN_CASE_DATA
      : GOLDEN_CASE_DATA.filter((d) => d.category === activeCategory);

  const handleCopy = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Caso Dorado de Prueba (Golden Case)"
      description="Expediente de referencia sucesorio con datos realistas para probar y diseñar plantillas."
      maxWidth="xl"
    >
      <div className="space-y-4">
        <div className="p-3 bg-secondary/50 rounded-xl border border-secondary text-xs flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Entorno de pruebas y validación sin datos reales:
            </p>
            <p className="text-muted-foreground text-[11px]">
              Utilice estos marcadores y valores al redactar sus modelos en Word para asegurar que
              el motor reemplace exactamente los campos requeridos en el Sprint 7 (Generación).
            </p>
          </div>
        </div>

        {/* Selector de categorías */}
        <div className="flex flex-wrap gap-1.5 pb-1 border-b border-border">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'ALL' ? 'Todos los campos' : cat}
            </button>
          ))}
        </div>

        {/* Tabla de Mapeo */}
        <div className="border border-border rounded-xl overflow-hidden bg-card max-h-[380px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold sticky top-0 bg-background">
              <tr>
                <th className="px-3 py-2.5">Marcador</th>
                <th className="px-3 py-2.5">Campo</th>
                <th className="px-3 py-2.5">Valor de Muestra Resuelto</th>
                <th className="px-3 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((item, idx) => {
                const isCopied = copiedIndex === idx;
                return (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-primary whitespace-nowrap">
                      {item.placeholder}
                    </td>
                    <td className="px-3 py-2 text-foreground font-medium whitespace-nowrap">
                      {item.label}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-pre-line text-[11px]">
                      {item.goldenValue}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.placeholder, idx)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-foreground hover:bg-muted/80 text-[11px]"
                        title="Copiar marcador"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{isCopied ? 'Listo' : 'Copiar'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
};
