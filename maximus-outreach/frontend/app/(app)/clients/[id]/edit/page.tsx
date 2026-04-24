"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useClient } from "@/lib/hooks/use-clients";
import { ClientForm } from "@/components/clients/client-form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/lib/hooks/use-page-title";

export default function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isOwner, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { data: client, isLoading: clientLoading } = useClient(id);
  usePageTitle("Edit Client");

  useEffect(() => {
    if (!authLoading && !isOwner) {
      router.replace("/dashboard");
    }
  }, [isOwner, authLoading, router]);

  if (authLoading || !isOwner) return null;

  if (clientLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  }

  if (!client) return null;

  return <ClientForm mode="edit" client={client} />;
}
