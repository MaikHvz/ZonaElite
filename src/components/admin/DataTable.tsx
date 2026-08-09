"use client";

import { useEffect, useState } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchKey?: string | string[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  canView?: (item: T) => boolean;
  emptyMessage?: string;
}

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  searchPlaceholder = "Buscar...",
  searchKey,
  onEdit,
  onDelete,
  onView,
  canView,
  emptyMessage = "No se encontraron registros",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 10;

  const filtered = searchKey
    ? data.filter((item) => {
        const keys = Array.isArray(searchKey) ? searchKey : [searchKey];
        const term = search.toLowerCase();
        return keys.some((k) =>
          String((item as Record<string, unknown>)[k] ?? "")
            .toLowerCase()
            .includes(term)
        );
      })
    : data;

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  useEffect(() => { setPage(0); }, [search]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {searchKey && (
        <div className="mb-4">
          <div className="relative max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg pl-10 pr-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-on-surface/5 rounded-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-on-surface/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant"
                >
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete || onView) && (
                <th className="text-right px-4 py-3 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete || onView ? 1 : 0)}
                  className="text-center py-12 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-on-surface/5 last:border-0 hover:bg-on-surface/[0.02] transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface"
                    >
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  {(onEdit || onDelete || onView) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onView && (!canView || canView(item)) && (
                          <button
                            onClick={() => onView(item)}
                            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                            title="Ver Ficha"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(item)}
                            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(item)}
                            className="text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
            {filtered.length} registros · Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 disabled:opacity-30 transition-colors text-[13px] cursor-pointer"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 disabled:opacity-30 transition-colors text-[13px] cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
