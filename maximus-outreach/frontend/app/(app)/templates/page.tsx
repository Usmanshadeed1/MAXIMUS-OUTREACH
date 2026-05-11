"use client";

import { useState } from "react";
import { Plus, FileText, Pencil, Trash2, Globe, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import {
  useGlobalTemplates,
  useCreateGlobalTemplate,
  useUpdateGlobalTemplate,
  useDeleteGlobalTemplate,
  type MessageTemplate,
} from "@/lib/hooks/use-templates";
import { TemplateDialog } from "@/components/templates/template-dialog";

export default function GlobalTemplatesPage() {
  usePageTitle("Templates");
  const { isOwner } = useAuth();

  const { data: templates = [], isLoading } = useGlobalTemplates();
  const createTemplate = useCreateGlobalTemplate();
  const updateTemplate = useUpdateGlobalTemplate();
  const deleteTemplate = useDeleteGlobalTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [toEdit, setToEdit] = useState<MessageTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Global Templates</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Reusable message templates available across all clients and campaigns.
          </p>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => { setToEdit(null); setDialogOpen(true); }}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2 shrink-0")}
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-border bg-card p-4 animate-pulse">
              <div className="h-4 w-48 bg-muted rounded mb-2" />
              <div className="h-3 w-full bg-muted/60 rounded mb-1" />
              <div className="h-3 w-3/4 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && templates.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-medium text-foreground">No global templates yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Global templates are available across all clients. Create one here, or promote a client template using "Make Global".
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={() => { setToEdit(null); setDialogOpen(true); }}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-5 gap-2")}
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Template
            </button>
          )}
        </div>
      )}

      {/* Template list */}
      {!isLoading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-border bg-card p-4 flex items-start gap-4"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{tpl.name}</p>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary font-medium">
                    <Globe className="h-2.5 w-2.5" />
                    Global
                  </span>
                </div>
                {tpl.subject && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    <span className="font-medium">Subject:</span> {tpl.subject}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.body}</p>
              </div>
              {isOwner && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setToEdit(tpl); setDialogOpen(true); }}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(tpl.id)}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-destructive hover:text-destructive")}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Template Dialog */}
      <TemplateDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setToEdit(null); }}
        client={null}
        initial={toEdit}
        isSaving={createTemplate.isPending || updateTemplate.isPending}
        onSave={async (data) => {
          try {
            if (toEdit) {
              await updateTemplate.mutateAsync({ id: toEdit.id, payload: data });
              toast.success("Template updated");
            } else {
              await createTemplate.mutateAsync(data);
              toast.success("Template saved");
            }
            setDialogOpen(false);
            setToEdit(null);
          } catch {
            toast.error("Failed to save template");
          }
        }}
      />

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-border bg-card p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-sm font-semibold text-foreground mb-2">Delete Global Template</h2>
            <p className="text-sm text-muted-foreground mb-5">
              This global template will be permanently deleted. Campaign steps that already loaded it keep their saved message.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteTemplate.isPending}
                onClick={async () => {
                  try {
                    await deleteTemplate.mutateAsync(deleteId);
                    toast.success("Template deleted");
                  } catch {
                    toast.error("Failed to delete template");
                  } finally {
                    setDeleteId(null);
                  }
                }}
                className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "gap-2")}
              >
                {deleteTemplate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
