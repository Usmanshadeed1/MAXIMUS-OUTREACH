"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClientStore } from "@/stores/client-store";

export default function CampaignsIndexPage() {
  const router = useRouter();
  const selectedClientId = useClientStore((s) => s.selectedClientId);

  useEffect(() => {
    if (selectedClientId) {
      router.replace(`/clients/${selectedClientId}?tab=campaigns`);
      return;
    }
    router.replace("/clients");
  }, [router, selectedClientId]);

  return null;
}
