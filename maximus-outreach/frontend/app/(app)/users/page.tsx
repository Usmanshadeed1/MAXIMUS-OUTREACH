"use client";

import { useEffect, useId, isValidElement, cloneElement, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  type AppUser,
  type UserCreate,
  type UserUpdate,
} from "@/lib/hooks/use-users";
import { useClients } from "@/lib/hooks/use-clients";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  UserX,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { usePageTitle } from "@/lib/hooks/use-page-title";

// ─── Shared primitives ─────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors";

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  const enhanced = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        ...(hintId ? { "aria-describedby": hintId } : {}),
        ...(required ? { "aria-required": true } : {}),
      })
    : children;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground cursor-default"
      >
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-destructive ml-0.5">*</span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {enhanced}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Client assignment picker ──────────────────────────────────────────────

function ClientPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data } = useClients(1, 100);
  const clients = data?.items ?? [];

  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  if (clients.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No clients available. Create clients first.
      </p>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
      {clients.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors",
              on
                ? "bg-primary/8 text-foreground"
                : "text-foreground hover:bg-muted/20"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                on ? "border-primary bg-primary" : "border-border bg-transparent"
              )}
            >
              {on && <Check className="h-3 w-3 text-primary-foreground" />}
            </span>
            <span className="truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Create user dialog ────────────────────────────────────────────────────

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const createMut = useCreateUser();
  const busy = createMut.isPending;

  const [form, setForm] = useState<UserCreate>({
    name: "",
    email: "",
    password: "",
    role: "manager",
    assigned_client_ids: [],
  });
  const set = (k: keyof UserCreate, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate(form, {
      onSuccess: () => {
        toast.success(`Manager "${form.name}" created`);
        onClose();
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Failed to create user";
        toast.error(msg);
      },
    });
  };

  return (
    <DialogShell title="Invite Manager" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label="Full Name" required>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            placeholder="Jane Smith"
            className={inputCls}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            placeholder="jane@example.com"
            className={inputCls}
          />
        </Field>
        <Field label="Password" required hint="Minimum 8 characters">
          <input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            className={inputCls}
          />
        </Field>
        <Field label="Assign Clients">
          <ClientPicker
            selected={form.assigned_client_ids ?? []}
            onChange={(ids) => set("assigned_client_ids", ids)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Manager
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── Edit user dialog ──────────────────────────────────────────────────────

function EditUserDialog({
  user,
  onClose,
}: {
  user: AppUser;
  onClose: () => void;
}) {
  const updateMut = useUpdateUser();
  const busy = updateMut.isPending;

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user.is_active);
  const [clientIds, setClientIds] = useState<string[]>(
    user.assigned_clients.map((c) => c.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UserUpdate & { id: string } = {
      id: user.id,
      name: name !== user.name ? name : undefined,
      email: email !== user.email ? email : undefined,
      password: password || undefined,
      is_active: isActive !== user.is_active ? isActive : undefined,
      assigned_client_ids: clientIds,
    };
    updateMut.mutate(payload, {
      onSuccess: () => {
        toast.success("User updated");
        onClose();
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Failed to update user";
        toast.error(msg);
      },
    });
  };

  return (
    <DialogShell title={`Edit — ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label="Full Name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="New Password" hint="Leave blank to keep current password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            placeholder="••••••••"
            className={inputCls}
          />
        </Field>
        <Field label="Status">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isActive ? "bg-primary" : "bg-muted/50 border border-border"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                  isActive ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            <span className="text-sm text-muted-foreground">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </Field>
        <Field label="Assigned Clients">
          <ClientPicker selected={clientIds} onChange={setClientIds} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

// ─── User row ──────────────────────────────────────────────────────────────

function UserRow({
  user,
  currentUserId,
}: {
  user: AppUser;
  currentUserId: string;
}) {
  const deactivateMut = useDeactivateUser();
  const [editing, setEditing] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);

  const isSelf = user.id === currentUserId;
  const isOwner = user.role === "owner";

  const handleDeactivate = () => {
    if (!deactivateConfirm) {
      setDeactivateConfirm(true);
      return;
    }
    deactivateMut.mutate(user.id, {
      onSuccess: () => toast.success(`${user.name} deactivated`),
      onError: () => toast.error("Failed to deactivate user"),
    });
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            {isOwner ? (
              <ShieldCheck className="h-4 w-4 text-primary" />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground text-sm leading-snug">
                {user.name}
              </p>
              {isSelf && (
                <span className="text-[10px] border border-primary/30 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  You
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium border",
                  isOwner
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                )}
              >
                {isOwner ? "Owner" : "Manager"}
              </span>
              {!user.is_active && (
                <span className="text-[10px] border border-border bg-muted/20 text-muted-foreground px-1.5 py-0.5 rounded-full">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {user.email}
            </p>
          </div>
        </div>

        {/* Assigned clients */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Assigned Clients
          </p>
          {user.assigned_clients.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">None</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {user.assigned_clients.map((c) => (
                <span
                  key={c.id}
                  className="text-[11px] rounded-md border border-border bg-muted/20 px-2 py-0.5 text-muted-foreground"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Member since */}
        <p className="text-[11px] text-muted-foreground/50">
          Joined{" "}
          {new Date(user.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        {/* Actions — not for owner or self */}
        {!isOwner && !isSelf && (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>

            {user.is_active && (
              <>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={deactivateMut.isPending}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ml-auto",
                    deactivateConfirm
                      ? "border-red-500/40 bg-red-500/10 text-red-400"
                      : "border-border bg-background text-muted-foreground hover:text-destructive"
                  )}
                >
                  {deactivateMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserX className="h-3.5 w-3.5" />
                  )}
                  {deactivateConfirm ? "Confirm Deactivate" : "Deactivate"}
                </button>
                {deactivateConfirm && (
                  <button
                    type="button"
                    onClick={() => setDeactivateConfirm(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {editing && (
        <EditUserDialog user={user} onClose={() => setEditing(false)} />
      )}
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser, isOwner, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  usePageTitle("User Management");

  useEffect(() => {
    if (!authLoading && !isOwner) {
      router.replace("/dashboard");
    }
  }, [isOwner, authLoading, router]);

  const { data, isLoading } = useUsers(page, 25);

  if (authLoading || !isOwner) return null;

  const users = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage manager accounts and their client access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Invite Manager
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span>{" "}
          {total === 1 ? "user" : "users"} total
        </p>
        {data && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {users.filter((u) => u.is_active).length}
            </span>{" "}
            active
          </p>
        )}
      </div>

      {/* User grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl border border-dashed border-border">
          <User className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No users found</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite First Manager
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              currentUserId={currentUser?.id ?? ""}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

