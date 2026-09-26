'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import { Search, Loader2, Copy, Check, Filter } from 'lucide-react';
import type { DocumentField } from '@workflow/shared';

export const DocumentFieldsDictionary: React.FC = () => {
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('document_fields')
        .select('*')
        .eq('is_active', true)
        .order('source_type', { ascending: true })
        .order('code', { ascending: true });

      if (error) throw error;
      setFields((data as DocumentField[]) || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar diccionario de campos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  const handleCopy = (code: string) => {
    const text = `{{${code}}}`;
    void navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sources = Array.from(new Set(fields.map((f) => f.source_type)));

  const filteredFields = fields.filter((f) => {
    const matchesSource = selectedSource === 'ALL' || f.source_type === selectedSource;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
      f.code.toLowerCase().includes(query) ||
      f.label.toLowerCase().includes(query) ||
      (f.description && f.description.toLowerCase().includes(query));
    return matchesSource && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            Catálogo de Campos Permitidos en Plantillas (Lista Blanca)
          </h2>
          <p className="text-xs text-muted-foreground">
            Solo los marcadores listados a continuación son admitidos por el motor de plantillas.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
          {errorMessage}
        </div>
      )}

      {/* Buscador y filtro */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por código (ej. case.number), nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-input bg-card text-foreground focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-input bg-card text-foreground focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="ALL">Todos los orígenes ({fields.length})</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs">Cargando campos autorizados...</p>
        </div>
      ) : filteredFields.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
          <p className="text-xs">No se encontraron campos con los criterios indicados.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Marcador DOCX</th>
                  <th className="px-4 py-3">Nombre descriptivo</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Tipo de Dato</th>
                  <th className="px-4 py-3">Requerido</th>
                  <th className="px-4 py-3 text-right">Copiar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFields.map((field) => {
                  const isCopied = copiedCode === field.code;
                  return (
                    <tr key={field.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-primary">
                        {`{{${field.code}}}`}
                      </td>
                      <td className="px-4 py-2.5 text-foreground font-medium">
                        <div>{field.label}</div>
                        {field.description && (
                          <div className="text-[11px] text-muted-foreground font-normal">
                            {field.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {field.source_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-[11px]">
                        {field.data_type}
                      </td>
                      <td className="px-4 py-2.5">
                        {field.is_required ? (
                          <span className="text-[10px] font-semibold text-destructive">Sí</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Opcional</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleCopy(field.code)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-foreground hover:bg-muted/80 text-[11px] transition-colors"
                          title="Copiar marcador al portapapeles"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
