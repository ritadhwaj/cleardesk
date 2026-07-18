import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import type { TableQuery, Paged } from "../api/client";

export interface Column<T> {
  key: string;                       // sort/filter key sent to the server
  label: string;
  sortable?: boolean;
  filter?: "text" | { options: string[] };
  className?: string;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  fetcher: (q: TableQuery) => Promise<Paged<T>>;
  rowKey: (row: T) => string | number;
  defaultSort?: string;
  refreshKey?: number;               // bump to force refetch (e.g. polling)
  onStats?: (stats: Record<string, number>) => void;
  emptyText?: string;
}

const PAGE_SIZES = [10, 20, 30, 50];

/** Server-driven table: pagination, per-column filters, sorting. */
export default function DataTable<T>({
  columns, fetcher, rowKey, defaultSort = "", refreshKey = 0,
  onStats, emptyText = "Nothing to show.",
}: Props<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState(defaultSort);
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [debounced, setDebounced] = useState(filters);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => { setPage(1); }, [debounced, pageSize]);

  useEffect(() => {
    const mySeq = ++seq.current;
    fetcher({ page, page_size: pageSize, sort, order, filters: debounced })
      .then((res) => {
        if (mySeq !== seq.current) return; // stale response
        setRows(res.items);
        setTotal(res.total);
        if (res.stats && onStats) onStats(res.stats);
      })
      .catch(() => {});
  }, [page, pageSize, sort, order, debounced, refreshKey]); // eslint-disable-line

  const toggleSort = (key: string) => {
    if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(key); setOrder("asc"); }
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const hasFilters = columns.some((c) => c.filter);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400
                           border-b border-slate-100 dark:border-slate-800">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                  {c.sortable ? (
                    <button onClick={() => toggleSort(c.key)}
                            className="inline-flex items-center gap-1 hover:text-slate-700
                                       dark:hover:text-slate-200 transition-colors uppercase">
                      {c.label}
                      {sort === c.key
                        ? (order === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
                        : <ChevronsUpDown size={13} className="opacity-40" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
            {hasFilters && (
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2">
                    {c.filter === "text" && (
                      <input className="input !py-1.5 !px-2.5 w-full !text-xs"
                             placeholder="Filter…"
                             value={filters[c.key] ?? ""}
                             onChange={(e) =>
                               setFilters((f) => ({ ...f, [c.key]: e.target.value }))} />
                    )}
                    {typeof c.filter === "object" && (
                      <select className="input !py-1.5 !px-2 w-full !text-xs"
                              value={filters[c.key] ?? ""}
                              onChange={(e) =>
                                setFilters((f) => ({ ...f, [c.key]: e.target.value }))}>
                        <option value="">All</option>
                        {c.filter.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows === null && [...Array(3)].map((_, i) => (
              <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60">
                <td className="px-4 py-4" colSpan={columns.length}>
                  <div className="skeleton h-5 w-full" />
                </td>
              </tr>
            ))}
            {rows?.map((r) => (
              <tr key={rowKey(r)}
                  className="border-b border-slate-50 dark:border-slate-800/60 last:border-0
                             hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3.5 ${c.className ?? ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {rows !== null && rows.length === 0 && (
              <tr><td colSpan={columns.length}
                      className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                {emptyText}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3
                      border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          Rows per page
          <select className="input !py-1 !px-2 !text-xs w-16" value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span>{from}–{to} of {total}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700
                               flex items-center justify-center disabled:opacity-30
                               hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="w-14 h-7 flex items-center justify-center font-semibold">
              {page} / {pages}
            </span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                    className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700
                               flex items-center justify-center disabled:opacity-30
                               hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
