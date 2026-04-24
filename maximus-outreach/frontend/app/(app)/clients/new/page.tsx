"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { ClientForm } from "@/components/clients/client-form";
import { usePageTitle } from "@/lib/hooks/use-page-title";

export default function NewClientPage() {
  const { isOwner, isLoading } = useAuth();
  const router = useRouter();
  usePageTitle("New Client");

  useEffect(() => {
    if (!isLoading && !isOwner) {
      router.replace("/dashboard");
    }
  }, [isOwner, isLoading, router]);

  if (isLoading || !isOwner) return null;

  return <ClientForm mode="create" />;
}
