'use client';

import React, { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, AlertCircle, FileCode } from 'lucide-react';
import type {
  CustomFieldDefinition,
  CustomFieldEntity,
  CustomFieldDataType,
} from '@workflow/shared';

interface CustomFieldsManagerProps {
  fields: CustomFieldDefinition[];
  onCreateField?: (field: Partial<CustomFieldDefinition>) => Promise<void>;
  onToggleActive?: (id: string, nextActive: boolean) => Promise<void>;
}

export const CustomFieldsManager: React.FC<CustomFieldsManagerProps> = ({
  fields,
  onCreateField,
  onToggleActive,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<CustomFieldEntity>('case');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [helpText, setHelpText] = useState('');
  const [dataType, setDataType] = useState<CustomFieldDataType>('TEXT');
  const [isRequired, setIsRequired] = useState(false);
  const [rawOptions, setRawOptions] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredFields = fields.filter((f) => f.entity === selectedEntity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!code.trim() || !label.trim()) {
      setErrorMsg('El código y la etiqueta son requeridos');
      return;
    }

    const optionsList =
      dataType === 'SELECT' || dataType === 'MULTISELECT'
        ? rawOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    try {
      await onCreateField?.({
        entity: selectedEntity,
        code: code.trim().toLowerCase(),
        label: label.trim(),
        help_text: helpText.trim() || undefined,
        data_type: dataType,
        is_required: isRequired,
        options: optionsList,
        is_active: true,
      });

      setIsModalOpen(false);
      setCode('');
      setLabel('');
      setHelpText('');
      setRawOptions('');
      setIsRequired(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al crear campo');
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de Entidad */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <FileCode className="w-5 h-5 text-primary" />
          <div>
            <span className="text-xs font-semibold text-foreground block">
              Campos Personalizados Dinámicos
            </span>
            <p className="text-[11px] text-muted-foreground">
              Agregue campos a las entidades del sistema sin realizar cambios en el código
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex rounded-lg border border-input p-0.5 bg-background">
            {(['client', 'case', 'case_process'] as CustomFieldEntity[]).map((ent) => (
              <button
                key={ent}
                type="button"
                onClick={() => setSelectedEntity(ent)}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                  selectedEntity === ent
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {ent === 'client' ? 'Clientes' : ent === 'case' ? 'Casos' : 'Procesos'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Campo
          </button>
        </div>
      </div>

      {/* Tabla de Campos */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Etiqueta</th>
                <th className="py-3 px-4">Tipo de Dato</th>
                <th className="py-3 px-4 text-center">Obligatorio</th>
                <th className="py-3 px-4">Ayuda / Descripción</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredFields.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hay campos personalizados configurados para {selectedEntity}.
                  </td>
                </tr>
              ) : (
                filteredFields.map((field) => (
                  <tr key={field.code} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      {field.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">{field.label}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-muted-foreground">
                        {field.data_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {field.is_required ? (
                        <span className="text-destructive font-bold">Sí</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{field.help_text || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => field.id && onToggleActive?.(field.id, !field.is_active)}
                        className="inline-flex items-center gap-1 cursor-pointer"
                      >
                        {field.is_active ? (
                          <ToggleRight className="w-6 h-6 text-primary" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                        )}
                        <span
                          className={
                            field.is_active ? 'text-primary font-semibold' : 'text-muted-foreground'
                          }
                        >
                          {field.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Crear Campo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card text-card-foreground border border-border w-full max-w-md rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-foreground">
              Nuevo Campo para: {selectedEntity.toUpperCase()}
            </h3>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Código (clave JSON) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. num_partida"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toLowerCase())}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Etiqueta visible *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. N.º de Partida Registral"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Tipo de Dato</label>
                  <select
                    value={dataType}
                    onChange={(e) => setDataType(e.target.value as CustomFieldDataType)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  >
                    <option value="TEXT">Texto (Línea)</option>
                    <option value="TEXTAREA">Texto (Área)</option>
                    <option value="NUMBER">Número</option>
                    <option value="CURRENCY">Moneda (S/)</option>
                    <option value="DATE">Fecha</option>
                    <option value="BOOLEAN">Booleano (Sí/No)</option>
                    <option value="SELECT">Selección Única</option>
                    <option value="MULTISELECT">Selección Múltiple</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="is_req"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary"
                  />
                  <label htmlFor="is_req" className="font-semibold text-foreground cursor-pointer">
                    Obligatorio
                  </label>
                </div>
              </div>

              {(dataType === 'SELECT' || dataType === 'MULTISELECT') && (
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Opciones (separadas por coma)
                  </label>
                  <input
                    type="text"
                    placeholder="Opción 1, Opción 2, Opción 3"
                    value={rawOptions}
                    onChange={(e) => setRawOptions(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-foreground mb-1">Texto de Ayuda</label>
                <input
                  type="text"
                  placeholder="Instrucciones para el usuario"
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  Guardar Campo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
