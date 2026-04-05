"use client";

import { useTransition } from "react";
import { retryExtraction } from "@/app/actions/extraction";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface RetryExtractionButtonProps {
  uploadId: string;
}

export default function RetryExtractionButton({
  uploadId,
}: RetryExtractionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await retryExtraction(uploadId);
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
      {isPending ? "Relance en cours…" : "Relancer l'extraction"}
    </Button>
  );
}
