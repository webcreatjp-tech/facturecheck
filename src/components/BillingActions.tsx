"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createCheckoutSession,
  createPortalSession,
} from "@/app/actions/billing";

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

type CheckoutProps = { mode: "checkout"; planId: "starter" | "pro" };
type PortalProps = { mode: "portal" };
type BillingActionsProps = CheckoutProps | PortalProps;

// --------------------------------------------------------------------------
// Composant
// --------------------------------------------------------------------------

export default function BillingActions(props: BillingActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      let result;
      if (props.mode === "checkout") {
        result = await createCheckoutSession(props.planId);
      } else {
        result = await createPortalSession();
      }

      if (result.success) {
        window.location.assign(result.url);
      } else {
        console.error("[BillingActions] error:", result.code);
      }
    });
  }

  if (props.mode === "portal") {
    return (
      <Button
        variant="outline"
        size="default"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Redirection…" : "Gérer l'abonnement"}
      </Button>
    );
  }

  return (
    <Button
      size="default"
      onClick={handleClick}
      disabled={isPending}
      className="w-full"
    >
      {isPending ? "Redirection…" : "Choisir ce plan"}
    </Button>
  );
}
