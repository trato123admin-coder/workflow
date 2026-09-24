'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  mobileHidden?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  actionsSlot?: React.ReactNode;
  mobileCardRender?: (item: T) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  searchPlaceholder = 'Buscar...',
  searchFilter,
  pageSize = 10,
  emptyTitle = 'No hay registros',
  emptyDescription = 'No se encontraron resultados para la búsqueda.',
  actionsSlot,
  mobileCardRender,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const filteredData = useMemo(() => {
    if (!query || !searchFilter) return data;
    return data.filter((item) => searchFilter(item, query));
  }, [data, query, searchFilter]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    const col = columns.find((c) => c.id === sortColumn);
    if (!col || !col.accessorKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = a[col.accessorKey!];
      const valB = b[col.accessorKey!];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const comp = String(valA).localeCompare(String(valB), 'es', { numeric: true });
      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  return (
    <div className="w-full space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {searchFilter && (
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        )}
        {actionsSlot && <div className="flex items-center gap-2 self-end sm:self-auto">{actionsSlot}</div>}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : sortedData.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      onClick={() => col.sortable && handleSort(col.id)}
                      className={cn(
                        'py-3.5 px-4 select-none',
                        col.sortable ? 'cursor-pointer hover:text-foreground transition-colors' : '',
                        col.className
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-muted-foreground">
                            {sortColumn === col.id ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-primary" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map((item) => (
                  <tr
                    key={keyExtractor(item)}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    {columns.map((col) => (
                      <td key={col.id} className={cn('py-3.5 px-4 text-foreground', col.className)}>
                        {col.cell
                          ? col.cell(item)
                          : col.accessorKey
                          ? String(item[col.accessorKey] ?? '')
                          : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< 768px, required by 01-anexo A.6) */}
          <div className="md:hidden space-y-3">
            {paginatedData.map((item) => (
              <div
                key={keyExtractor(item)}
                className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-2.5"
              >
                {mobileCardRender ? (
                  mobileCardRender(item)
                ) : (
                  <div className="space-y-1.5">
                    {columns.map((col) => (
                      <div key={col.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                        <span className="text-muted-foreground font-medium">{col.header}:</span>
                        <span className="text-foreground font-semibold">
                          {col.cell
                            ? col.cell(item)
                            : col.accessorKey
                            ? String(item[col.accessorKey] ?? '')
                            : null}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>
                Mostrando {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, sortedData.length)} de {sortedData.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Página anterior"
                  className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 font-medium text-foreground">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Página siguiente"
                  className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
