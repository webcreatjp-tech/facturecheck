"use client";

import { useTransition } from "react";
import { retryOcr } from "@/app/actions/ocr";
import { Button } from "@/components/ui/button";

interface RetryOcrButtonProps {
  uploadId: string;
}

export default function RetryOcrButton({ uploadId }: RetryOcrButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      const result = await retryOcr(uploadId);
      if (!result.success && result.code !== "already_processing") {
        console.error("[RetryOcrButton] Échec de la relance :", result.code);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={isPending}
      aria-label="Relancer l'analyse OCR pour cette facture"
    >
      {isPending ? "Relance…" : "Réessayer"}
    </Button>
  );
}
