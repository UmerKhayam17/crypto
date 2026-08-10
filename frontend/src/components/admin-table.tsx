import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type AdminColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Mobile label inside the stacked card. Defaults to header. */
  mobileLabel?: string;
  /** Hide this column in the mobile stacked card. */
  hideOnMobile?: boolean;
  align?: "left" | "right";
  className?: string;
};

export type AdminFilter = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
};

type Props<T> = {
  title: string;
  rows: T[];
  columns: AdminColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchKeys?: (row: T) => string;
  filters?: AdminFilter[];
  emptyLabel?: string;
  pageSize?: number;
  /** Render-only key prefix for localStorage of pagination, etc. */
  storageKey?: string;
};

export function AdminTable<T>({
  title, rows, columns, rowKey, searchPlaceholder = "Search…",
  searchKeys, filters, emptyLabel = "Nothing here yet.", pageSize = 10,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && searchKeys) {
        if (!searchKeys(r).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
      <div className="flex flex-col gap-3 border-b border-border/60 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder}
              className="h-8 w-full pl-7 text-xs sm:w-56"
            />
          </div>
          {filters?.map((f) => (
            <Select key={f.key} value={f.value} onValueChange={(v) => { f.onChange(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-36">
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={`px-3 py-3 ${c.align === "right" ? "text-right" : "text-left"}`}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paged.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-3 ${c.align === "right" ? "text-right" : "text-left"} ${c.className ?? ""}`}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <ul className="divide-y divide-border/60 md:hidden">
            {paged.map((row) => (
              <li key={rowKey(row)} className="px-3 py-3 space-y-1.5">
                {columns.filter((c) => !c.hideOnMobile).map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-xs uppercase text-muted-foreground">{c.mobileLabel ?? c.header}</span>
                    <span className={`text-right ${c.className ?? ""}`}>{c.cell(row)}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground sm:px-4">
              <div>
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                <span className="px-2 font-mono">{safePage}/{totalPages}</span>
                <Button size="sm" variant="outline" disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}