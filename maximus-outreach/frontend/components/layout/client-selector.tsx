"use client";

import { useAuth } from "@/contexts/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Building2, Check } from "lucide-react";
import { useClientStore } from "@/stores/client-store";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function ClientSelector() {
  const { user } = useAuth();
  const { selectedClientId, setSelectedClientId } = useClientStore();

  const clients = user?.assigned_clients ?? [];

  // Auto-select first client if none selected
  useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId, setSelectedClientId]);

  if (clients.length === 0) return null;

  const selected = clients.find((c) => c.id === selectedClientId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 max-w-[130px] sm:max-w-[200px] rounded-md border border-input bg-transparent px-2 sm:px-3 py-1.5 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        aria-label="Select client"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-medium">
          {selected?.name ?? "Select client"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
            Your Clients
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {clients.map((client) => (
          <DropdownMenuItem
            key={client.id}
            onClick={() => setSelectedClientId(client.id)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{client.name}</span>
            {client.id === selectedClientId && (
              <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
