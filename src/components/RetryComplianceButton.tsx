"use client";

import { useTransition } from "react";
import { retryCompliance } from "@/app/actions/compliance";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface RetryComplianceButtonProps {
  uploadId: string;
}

export default function RetryComplianceButton({
  uploadId,
}: RetryComplianceButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await retryCompliance(uploadId);
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
    >
      <RefreshCw
        className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`}
        aria-hidden
      />
      {isPending ? "Vérification en cours…" : "Relancer la vérification"}
    </Button>
  );
}
