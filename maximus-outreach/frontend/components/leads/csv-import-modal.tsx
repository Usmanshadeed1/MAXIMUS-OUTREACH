"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useImportLeads } from "@/lib/hooks/use-leads";
import type { LeadImport } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "upload" | "preview" | "importing" | "result";

// ─── CSV preview parser ────────────────────────────────────────────────────────

function parseCSVPreview(text: string, maxRows = 5): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1, maxRows + 1).map(parseRow);
  return { headers, rows };
}

// ─── Recognised columns ───────────────────────────────────────────────────────

const KNOWN_COLUMNS: Record<string, string> = {
  keyword: "Keyword",
  location: "Location",
  title: "Business Name",
  business_name: "Business Name",
  address: "Address",
  phone: "Phone",
  website: "Website",
  rating: "Rating",
  reviews: "Reviews",
  email: "Email",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  twitter: "Twitter",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  source: "Source",
  notes: "Notes",
  tags: "Tags",
};

function getColumnBadge(header: string): "matched" | "extra" {
  return header.toLowerCase() in KNOWN_COLUMNS ? "matched" : "extra";
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({
  onFile,
}: {
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors select-none",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
    >
      <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Upload className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop your CSV file here
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          or{" "}
          <span className="text-primary underline underline-offset-2">browse files</span>
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground">CSV files only · max 50 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CsvImportModalProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CsvImportModal({ clientId, open, onClose }: CsvImportModalProps) {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] }>({
    headers: [],
    rows: [],
  });
  const [result, setResult] = useState<LeadImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const importMutation = useImportLeads(clientId);

  // Reset when dialog closes
  const handleClose = () => {
    setStage("upload");
    setFile(null);
    setPreview({ headers: [], rows: [] });
    setResult(null);
    setImportError(null);
    onClose();
  };

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPreview(parseCSVPreview(text, 5));
      setStage("preview");
    };
    reader.readAsText(f);
  };

  const handleImport = () => {
    if (!file) return;
    setStage("importing");
    setImportError(null);
    importMutation.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        setStage("result");
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "Import failed. Please check your file and try again.";
        setImportError(msg);
        setStage("preview");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl w-full border-border bg-card p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Import Leads from CSV
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {stage === "upload" && "Upload a CSV exported from your lead scraper."}
                {stage === "preview" && "Review your file before importing."}
                {stage === "importing" && "Importing leads, please wait…"}
                {stage === "result" && "Import complete."}
              </DialogDescription>
            </div>
            <button
              onClick={handleClose}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-8 w-8 text-muted-foreground shrink-0"
              )}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">

          {/* ── Upload stage ── */}
          {stage === "upload" && (
            <DropZone onFile={handleFile} />
          )}

          {/* ── Preview stage ── */}
          {(stage === "preview" || stage === "importing") && file && (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {stage === "preview" && (
                  <button
                    onClick={() => { setFile(null); setStage("upload"); }}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "h-7 w-7 text-muted-foreground ml-auto shrink-0"
                    )}
                    aria-label="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Column mapping */}
              {preview.headers.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    Detected Columns ({preview.headers.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.headers.map((h) => {
                      const type = getColumnBadge(h);
                      return (
                        <span
                          key={h}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                            type === "matched"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          )}
                        >
                          {type === "matched" ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {h}
                          {type === "matched" && (
                            <span className="text-muted-foreground">
                              → {KNOWN_COLUMNS[h.toLowerCase()]}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    <span className="text-emerald-400 font-medium">
                      {preview.headers.filter((h) => getColumnBadge(h) === "matched").length} matched
                    </span>
                    {" · "}
                    <span className="text-zinc-400">
                      {preview.headers.filter((h) => getColumnBadge(h) === "extra").length} unrecognised (will be ignored)
                    </span>
                  </p>
                </div>
              )}

              <Separator />

              {/* Preview table */}
              {preview.rows.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    Preview (first {preview.rows.length} rows)
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {preview.headers.map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-border last:border-0">
                            {preview.headers.map((_, ci) => (
                              <td
                                key={ci}
                                className="px-3 py-2 text-foreground max-w-[160px] truncate"
                              >
                                {row[ci] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Error */}
              {importError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                  <XCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-sm text-rose-400">{importError}</p>
                </div>
              )}
            </>
          )}

          {/* ── Importing spinner ── */}
          {stage === "importing" && (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="h-5 w-5 text-primary animate-spin" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Uploading and processing…</p>
            </div>
          )}

          {/* ── Result stage ── */}
          {stage === "result" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Import Complete</p>
                  <p className="text-xs text-muted-foreground">{result.file_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ResultStat
                  label="Total Rows"
                  value={result.total_rows}
                  color="default"
                />
                <ResultStat
                  label="Imported"
                  value={result.imported_count}
                  color="emerald"
                />
                <ResultStat
                  label="Duplicates"
                  value={result.duplicates_skipped}
                  color="amber"
                />
                <ResultStat
                  label="Errors"
                  value={result.errors_count}
                  color="rose"
                />
              </div>

              {result.errors_count > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-amber-400">
                    {result.errors_count} row{result.errors_count !== 1 ? "s" : ""} could not be imported due to missing or invalid data.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          {stage === "upload" && (
            <button
              onClick={handleClose}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Cancel
            </button>
          )}
          {stage === "preview" && (
            <>
              <button
                onClick={() => { setFile(null); setStage("upload"); }}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!file}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
              >
                <Upload className="h-3.5 w-3.5" />
                Import{preview.rows.length > 0 ? " Now" : ""}
              </button>
            </>
          )}
          {stage === "importing" && (
            <button
              disabled
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2 opacity-70")}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Importing…
            </button>
          )}
          {stage === "result" && (
            <>
              <button
                onClick={() => { setStage("upload"); setFile(null); setResult(null); }}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Import Another
              </button>
              <button
                onClick={handleClose}
                className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              >
                Done
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Result stat card ─────────────────────────────────────────────────────────

function ResultStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "default" | "emerald" | "amber" | "rose";
}) {
  const colorMap = {
    default: "text-foreground",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  };
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3 text-center">
      <p className={cn("text-xl font-bold tabular-nums", colorMap[color])}>{value.toLocaleString()}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
