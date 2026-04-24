"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Copy,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useImportHistory } from "@/lib/hooks/use-leads";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  completed: {
    label: "Completed",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  processing: {
    label: "Processing",
    classes: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  failed: {
    label: "Failed",
    classes: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? {
    label: status,
    classes: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
        s.classes
      )}
    >
      {s.label}
    </span>
  );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({
  value,
  icon: Icon,
  color = "muted",
}: {
  value: number;
  icon: React.ElementType;
  color?: "muted" | "emerald" | "amber" | "rose";
}) {
  const colorMap = {
    muted: "text-muted-foreground",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", colorMap[color])}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {value.toLocaleString()}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImportHistoryProps {
  clientId: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImportHistory({ clientId }: ImportHistoryProps) {
  const [expanded, setExpanded] = useState(true);
  const { data: imports, isLoading } = useImportHistory(clientId);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/20 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Import History</span>
          {!isLoading && imports && imports.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              ({imports.length} import{imports.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <>
          {/* Loading */}
          {isLoading && (
            <div className="p-5 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && (!imports || imports.length === 0) && (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <Inbox className="h-8 w-8 text-muted-foreground/30" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No imports yet.</p>
              <p className="text-xs text-muted-foreground">
                Use the &ldquo;Import Leads&rdquo; button to upload a CSV file.
              </p>
            </div>
          )}

          {/* Table */}
          {!isLoading && imports && imports.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-2.5 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      File
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Date
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Status
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Total
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Imported
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Duplicates
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr
                      key={imp.id}
                      className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
                    >
                      {/* File name */}
                      <td className="px-5 py-3 max-w-[200px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText
                            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                            aria-hidden="true"
                          />
                          <span className="text-foreground text-xs font-medium truncate">
                            {imp.file_name}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(imp.imported_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <span className="ml-1 text-[10px]">
                          {new Date(imp.imported_at).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        <StatusBadge status={imp.status} />
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3 text-right text-xs">
                        <StatCell value={imp.total_rows} icon={FileText} color="muted" />
                      </td>

                      {/* Imported */}
                      <td className="px-5 py-3 text-right text-xs">
                        <StatCell value={imp.imported_count} icon={CheckCircle2} color="emerald" />
                      </td>

                      {/* Duplicates */}
                      <td className="px-5 py-3 text-right text-xs">
                        <StatCell value={imp.duplicates_skipped} icon={Copy} color="amber" />
                      </td>

                      {/* Errors */}
                      <td className="px-5 py-3 text-right text-xs">
                        <StatCell
                          value={imp.errors_count}
                          icon={imp.errors_count > 0 ? XCircle : AlertCircle}
                          color={imp.errors_count > 0 ? "rose" : "muted"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer totals */}
                {imports.length > 1 && (
                  <tfoot>
                    <tr className="border-t border-border bg-muted/10">
                      <td
                        colSpan={3}
                        className="px-5 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium"
                      >
                        Total ({imports.length} imports)
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                        {imports.reduce((s, i) => s + i.total_rows, 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-emerald-400 tabular-nums">
                        {imports.reduce((s, i) => s + i.imported_count, 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-amber-400 tabular-nums">
                        {imports.reduce((s, i) => s + i.duplicates_skipped, 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-rose-400 tabular-nums">
                        {imports.reduce((s, i) => s + i.errors_count, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
