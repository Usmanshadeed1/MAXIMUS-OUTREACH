"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Trash2,
  CheckSquare,
  Star,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Eye,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLeads, useBulkStatus, useBulkDelete } from "@/lib/hooks/use-leads";
import { LeadDetailSheet } from "./lead-detail-sheet";
import type { Lead } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ["new", "contacted", "replied", "converted", "opted_out", "invalid"] as const;

const STATUS_STYLES: Record<string, string> = {
  new: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  contacted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  replied: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  converted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  opted_out: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  invalid: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const PAGE_SIZES = [25, 50, 100] as const;

// ─── Social icon row ──────────────────────────────────────────────────────────

const SOCIAL_FIELDS: { key: keyof Lead; label: string; color: string }[] = [
  { key: "facebook", label: "FB", color: "text-blue-400" },
  { key: "instagram", label: "IG", color: "text-pink-400" },
  { key: "linkedin", label: "LI", color: "text-sky-400" },
  { key: "youtube", label: "YT", color: "text-red-400" },
  { key: "twitter", label: "X", color: "text-zinc-400" },
  { key: "tiktok", label: "TK", color: "text-purple-400" },
];

function SocialIcons({ lead }: { lead: Lead }) {
  const active = SOCIAL_FIELDS.filter((s) => lead[s.key]);
  if (active.length === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      {active.map(({ key, label, color }) => (
        <a
          key={key}
          href={lead[key] as string}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={label}
          className={cn("text-[10px] font-bold hover:opacity-70 transition-opacity", color)}
        >
          {label}
        </a>
      ))}
    </div>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (!direction) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/40" />;
  return direction === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />
    : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
}

// ─── Column visibility dropdown ───────────────────────────────────────────────

function ColumnToggle({
  allColumns,
  onToggle,
}: {
  allColumns: { id: string; isVisible: boolean; label: string }[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-2 text-muted-foreground"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Columns
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-border bg-popover shadow-lg p-1">
            {allColumns.map((col) => (
              <button
                key={col.id}
                onClick={() => onToggle(col.id)}
                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm hover:bg-muted/50 text-left"
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded border flex-shrink-0",
                    col.isVisible
                      ? "bg-primary border-primary"
                      : "border-border"
                  )}
                />
                {col.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Bulk action bar ─────────────────────────────────────────────────────────

function BulkBar({
  count,
  isOwner,
  onStatusChange,
  onDelete,
  onClear,
  isMutating,
}: {
  count: number;
  isOwner: boolean;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onClear: () => void;
  isMutating: boolean;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-sm">
      <span className="font-medium text-foreground">{count} selected</span>
      <div className="h-4 w-px bg-border" />

      {/* Change status */}
      <div className="relative">
        <button
          onClick={() => setStatusOpen((p) => !p)}
          disabled={isMutating}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-2 h-7"
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Set Status
        </button>
        {statusOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-20 w-40 rounded-xl border border-border bg-popover shadow-lg p-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onStatusChange(s);
                    setStatusOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm hover:bg-muted/50 capitalize text-left"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full border",
                      STATUS_STYLES[s]
                    )}
                  />
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete (owner only) */}
      {isOwner && (
        <button
          onClick={onDelete}
          disabled={isMutating}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-2 h-7 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
          )}
        >
          {isMutating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Delete
        </button>
      )}

      <button
        onClick={onClear}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
      >
        Clear
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LeadsTableProps {
  clientId: string;
  isOwner: boolean;
}

const colHelper = createColumnHelper<Lead>();

export function LeadsTable({ clientId, isOwner }: LeadsTableProps) {
  // ── Filter state (local — resets page on change) ──
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hasEmail, setHasEmail] = useState<boolean | undefined>();
  const [hasPhone, setHasPhone] = useState<boolean | undefined>();
  const [hasSocial, setHasSocial] = useState<boolean | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);

  // ── Table state ──
  const [sorting, setSorting] = useState<SortingState>([]);
  const [colVisibility, setColVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // ── Debounce search ──
  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    const t = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, []);

  // ── Data ──
  const { data, isLoading, isFetching } = useLeads(clientId, {
    page,
    page_size: pageSize,
    status: statusFilter || undefined,
    has_email: hasEmail,
    has_phone: hasPhone,
    has_social: hasSocial,
    search: debouncedSearch || undefined,
  });

  const bulkStatus = useBulkStatus(clientId);
  const bulkDelete = useBulkDelete(clientId);

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  // ── Columns ──
  const columns = useMemo(
    () => [
      // Checkbox
      colHelper.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            className="accent-primary h-3.5 w-3.5 cursor-pointer"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="accent-primary h-3.5 w-3.5 cursor-pointer"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
        size: 36,
        enableSorting: false,
      }),
      // Business name
      colHelper.accessor("business_name", {
        id: "business_name",
        header: "Name",
        cell: (info) => (
          <span className="font-medium text-foreground">
            {info.getValue() ?? <span className="text-muted-foreground/50 italic">Unnamed</span>}
          </span>
        ),
        size: 200,
      }),
      // Status
      colHelper.accessor("status", {
        id: "status",
        header: "Status",
        cell: (info) => (
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
              STATUS_STYLES[info.getValue()] ?? "bg-muted text-muted-foreground"
            )}
          >
            {info.getValue().replace("_", " ")}
          </span>
        ),
        size: 110,
      }),
      // Email
      colHelper.accessor("email", {
        id: "email",
        header: () => <Mail className="h-3.5 w-3.5" aria-label="Email" />,
        cell: (info) =>
          info.getValue() ? (
            <a
              href={`mailto:${info.getValue()}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline text-xs truncate max-w-[160px] block"
            >
              {info.getValue()}
            </a>
          ) : (
            <span className="text-muted-foreground/40 text-xs">—</span>
          ),
        size: 180,
        enableSorting: false,
      }),
      // Phone
      colHelper.accessor("phone", {
        id: "phone",
        header: () => <Phone className="h-3.5 w-3.5" aria-label="Phone" />,
        cell: (info) =>
          info.getValue() ? (
            <span className="text-xs text-foreground">{info.getValue()}</span>
          ) : (
            <span className="text-muted-foreground/40 text-xs">—</span>
          ),
        size: 140,
        enableSorting: false,
      }),
      // Website
      colHelper.accessor("website", {
        id: "website",
        header: () => <Globe className="h-3.5 w-3.5" aria-label="Website" />,
        cell: (info) =>
          info.getValue() ? (
            <a
              href={info.getValue()!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline text-xs truncate max-w-[160px] block"
            >
              {info.getValue()!.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span className="text-muted-foreground/40 text-xs">—</span>
          ),
        size: 160,
        enableSorting: false,
      }),
      // Rating
      colHelper.accessor("rating", {
        id: "rating",
        header: () => <Star className="h-3.5 w-3.5" aria-label="Rating" />,
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" aria-hidden="true" />
              {Number(info.getValue()).toFixed(1)}
            </span>
          ) : (
            <span className="text-muted-foreground/40 text-xs">—</span>
          ),
        size: 80,
      }),
      // Socials
      colHelper.display({
        id: "socials",
        header: "Socials",
        cell: ({ row }) => <SocialIcons lead={row.original} />,
        size: 110,
        enableSorting: false,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, columnVisibility: colVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: false,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  // ── Selected IDs ──
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  // ── Bulk handlers ──
  async function handleBulkStatus(status: string) {
    try {
      await bulkStatus.mutateAsync({ leadIds: selectedIds, status });
      toast.success(`${selectedIds.length} leads updated to "${status}"`);
      setRowSelection({});
    } catch {
      toast.error("Failed to update status.");
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} leads? This cannot be undone.`)) return;
    try {
      await bulkDelete.mutateAsync(selectedIds);
      toast.success(`${selectedIds.length} leads deleted.`);
      setRowSelection({});
    } catch {
      toast.error("Failed to delete leads.");
    }
  }

  // ── Column toggle info ──
  const toggleableColumns = [
    { id: "email", label: "Email" },
    { id: "phone", label: "Phone" },
    { id: "website", label: "Website" },
    { id: "rating", label: "Rating" },
    { id: "socials", label: "Socials" },
  ];

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-background"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>
          ))}
        </select>

        {/* Has email */}
        <select
          value={hasEmail === undefined ? "" : hasEmail ? "true" : "false"}
          onChange={(e) => {
            setHasEmail(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Any email</option>
          <option value="true">Has email</option>
          <option value="false">No email</option>
        </select>

        {/* Has phone */}
        <select
          value={hasPhone === undefined ? "" : hasPhone ? "true" : "false"}
          onChange={(e) => {
            setHasPhone(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Any phone</option>
          <option value="true">Has phone</option>
          <option value="false">No phone</option>
        </select>

        {/* Has social */}
        <select
          value={hasSocial === undefined ? "" : hasSocial ? "true" : "false"}
          onChange={(e) => {
            setHasSocial(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Any social</option>
          <option value="true">Has social</option>
          <option value="false">No social</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* Column toggle */}
          <ColumnToggle
            allColumns={toggleableColumns.map((c) => ({
              ...c,
              isVisible: table.getColumn(c.id)?.getIsVisible() ?? true,
            }))}
            onToggle={(id) => table.getColumn(id)?.toggleVisibility()}
          />
        </div>
      </div>

      {/* ── Bulk bar ── */}
      {selectedIds.length > 0 && (
        <BulkBar
          count={selectedIds.length}
          isOwner={isOwner}
          onStatusChange={handleBulkStatus}
          onDelete={handleBulkDelete}
          onClear={() => setRowSelection({})}
          isMutating={bulkStatus.isPending || bulkDelete.isPending}
        />
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium select-none"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="inline-flex items-center hover:text-foreground transition-colors"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon direction={header.column.getIsSorted()} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  ))}
                  {/* Actions col */}
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium w-10" />
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    {total === 0
                      ? "No leads yet. Import a CSV to get started."
                      : "No leads match the current filters."}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedLead(row.original)}
                    className={cn(
                      "border-b border-border last:border-0 cursor-pointer transition-colors",
                      "hover:bg-muted/20",
                      row.getIsSelected() && "bg-primary/5"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    {/* View icon */}
                    <td className="px-3 py-3 align-middle">
                      <Eye className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground" aria-hidden="true" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page:</span>
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setPage(1); }}
                className={cn(
                  "px-2 py-0.5 rounded text-xs transition-colors",
                  pageSize === size
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:text-foreground"
                )}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            <span>
              {total === 0
                ? "0 leads"
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-7 w-7 p-0 disabled:opacity-30"
                )}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="w-16 text-center">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-7 w-7 p-0 disabled:opacity-30"
                )}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lead detail sheet ── */}
      <LeadDetailSheet
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
