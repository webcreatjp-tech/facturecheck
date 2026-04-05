import type { SubscriptionStatus } from "@/lib/billing/types";
import Link from "next/link";

// --------------------------------------------------------------------------
// Couleurs par plan
// --------------------------------------------------------------------------

const BADGE_STYLES: Record<SubscriptionStatus, string> = {
  free: "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-violet-100 text-violet-700",
  canceled: "bg-red-100 text-red-600",
};

const PLAN_LABELS: Record<SubscriptionStatus, string> = {
  free: "Gratuit",
  starter: "Starter",
  pro: "Pro",
  canceled: "Annulé",
};

// --------------------------------------------------------------------------
// Composant
// --------------------------------------------------------------------------

interface PlanBadgeProps {
  status: SubscriptionStatus;
}

export default function PlanBadge({ status }: PlanBadgeProps) {
  return (
    <Link
      href="/dashboard/billing"
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        "transition-opacity hover:opacity-80",
        BADGE_STYLES[status],
      ].join(" ")}
      title="Gérer l'abonnement"
    >
      {PLAN_LABELS[status]}
    </Link>
  );
}
