"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GenUIComponent } from "@/lib/genui/schemas";
import { tableRowsToSelection } from "@/lib/genui/selection";
import { cn } from "@/lib/utils";
import { useGenUIInteraction } from "./interaction-context";

type DataTableProps = Extract<GenUIComponent, { component: "DataTable" }>;
type ListProps = Extract<GenUIComponent, { component: "List" }>;
type Row = Record<string, string | number | boolean | null>;

function formatCell(value: string | number | boolean | null): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number")
    return Number.isInteger(value) ? value.toLocaleString("en-US") : `${value}`;
  return value;
}

/**
 * Stable row key from cell content. Rows reorder on sort, so index keys
 * would mix up checkbox state — content keys move with the row.
 */
function rowKey(row: Row, index: number): string {
  const content = Object.values(row)
    .map((v) => String(v ?? ""))
    .join("¦");
  return `${content}¦${index}`;
}

export function DataTable({ title, columns, rows }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const { selectForConversation } = useGenUIInteraction();

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, filter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  const toggleRow = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === sorted.length
        ? new Set()
        : new Set(sorted.map((_, i) => i)),
    );
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-depth shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <div className="relative w-44">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
            aria-hidden
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar…"
            aria-label="Filtrar filas"
            className="h-8 bg-white/[0.04] pl-8 text-xs placeholder:text-text-muted"
          />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.08] hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={
                  sorted.length > 0 && selected.size === sorted.length
                    ? true
                    : selected.size > 0
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={toggleAll}
                aria-label="Seleccionar todas las filas"
              />
            </TableHead>
            {columns.map((col) => {
              const active = sortKey === col.key;
              const Icon = active
                ? sortDir === "asc"
                  ? ArrowUp
                  : ArrowDown
                : ArrowUpDown;
              return (
                <TableHead
                  key={col.key}
                  className={cn(col.numeric && "text-right")}
                  aria-sort={
                    active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    aria-label={`Ordenar por ${col.label}`}
                    className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                  >
                    {col.label}
                    <Icon
                      className={cn(
                        "h-3 w-3",
                        active ? "text-ember" : "opacity-40",
                      )}
                      aria-hidden
                    />
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow
              key={rowKey(row, i)}
              data-state={selected.has(i) ? "selected" : undefined}
              className="hover:bg-white/[0.02]"
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(i)}
                  onCheckedChange={() => toggleRow(i)}
                  aria-label={`Seleccionar fila ${i + 1}`}
                />
              </TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "text-text-secondary",
                    col.numeric && "text-right font-mono",
                  )}
                >
                  {formatCell(row[col.key] ?? null)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length + 1}
                className="py-6 text-center text-xs text-text-tertiary"
              >
                Sin resultados para el filtro actual.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <p className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2 text-xs text-text-tertiary">
        <span>
          {sorted.length} {sorted.length === 1 ? "fila" : "filas"}
          {selected.size > 0 &&
            ` · ${selected.size} seleccionada${selected.size === 1 ? "" : "s"}`}
        </span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => {
              const selection = tableRowsToSelection({
                tableTitle: title,
                rows: sorted,
                selectedIndices: selected,
              });
              if (selection) {
                selectForConversation(selection);
                setSelected(new Set());
              }
            }}
            className="shrink-0 rounded-lg border border-ember/40 bg-ember/10 px-2.5 py-1 font-medium text-ember transition hover:bg-ember/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
          >
            Preguntar sobre la selección
          </button>
        )}
      </p>
    </div>
  );
}

export function GenUIList({ title, items }: ListProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-depth p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      {title ? (
        <h3 className="mb-2 text-sm font-semibold text-text-primary">
          {title}
        </h3>
      ) : null}
      <ul className="divide-y divide-white/[0.06]">
        {items.map((item, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: static message content, never reorders
            key={`${item.title}-${i}`}
            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {item.title}
              </p>
              {item.subtitle ? (
                <p className="truncate text-xs text-text-tertiary">
                  {item.subtitle}
                </p>
              ) : null}
            </div>
            {item.value ? (
              <span className="shrink-0 font-mono text-sm text-text-secondary">
                {item.value}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { Row as GenUITableRow };
