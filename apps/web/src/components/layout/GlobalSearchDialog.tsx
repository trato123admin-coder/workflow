'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FolderKanban, User, Building, Lock, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

export interface GlobalSearchResult {
  entity_type: 'CASE' | 'PERSON';
  entity_id: string;
  title: string;
  subtitle: string;
  badge: string;
  route_url: string;
  metadata: {
    case_number?: string;
    is_confidential?: boolean;
    document_type?: string;
    document_number?: string;
    person_type?: string;
    status_category?: string;
    email?: string;
    phone?: string;
  };
}

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (item: GlobalSearchResult) => {
      onClose();
      router.push(item.route_url);
    },
    [onClose, router],
  );

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('global_search', {
        _query: trimmed,
        _limit: 15,
      });

      if (!error && Array.isArray(data)) {
        setResults(data as GlobalSearchResult[]);
        setSelectedIndex(0);
      } else {
        setResults([]);
      }
      setIsLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Teclado: Escape, ArrowUp, ArrowDown, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          results.length > 0 ? (prev - 1 + results.length) % results.length : 0,
        );
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, handleSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150">
        {/* Barra de entrada de búsqueda */}
        <div className="relative border-b border-border flex items-center px-4 py-3 bg-card">
          <Search className="w-5 h-5 text-muted-foreground shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por expediente, título, nombre, DNI o RUC..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0 ml-2" />
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded">
              ESC para salir
            </kbd>
          )}
        </div>

        {/* Lista de Resultados */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-border/40">
          {query.trim().length < 2 && (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Ingresa al menos 2 caracteres para buscar en expedientes y personas.
            </div>
          )}

          {!isLoading && query.trim().length >= 2 && results.length === 0 && (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No se encontraron coincidencias para &ldquo;{query}&rdquo;.
            </div>
          )}

          {results.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const isCase = item.entity_type === 'CASE';
            const isConfidential = isCase && item.metadata?.is_confidential;

            return (
              <div
                key={`${item.entity_type}-${item.entity_id}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isCase ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {isCase ? (
                      <FolderKanban className="w-4 h-4" />
                    ) : item.metadata?.person_type === 'JURIDICA' ? (
                      <Building className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold truncate text-foreground">{item.title}</p>
                      {isConfidential && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Lock className="w-3 h-3" />
                          <span>Confidencial</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                    {item.badge}
                  </span>
                  <ArrowRight
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? 'translate-x-0.5 text-primary opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pie informativo de atajos */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Navega con <kbd className="font-mono bg-card px-1 rounded border border-border">↑</kbd>{' '}
            <kbd className="font-mono bg-card px-1 rounded border border-border">↓</kbd>
          </span>
          <span>
            Selecciona con{' '}
            <kbd className="font-mono bg-card px-1.5 rounded border border-border">Enter</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
