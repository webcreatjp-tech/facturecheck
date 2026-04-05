import { getUserProfile } from "@/app/actions/billing";
import { PLANS } from "@/lib/billing/types";
import BillingActions from "@/components/BillingActions";
import { CreditCard, CheckCircle, AlertCircle } from "lucide-react";

export const metadata = {
  title: "Abonnement – FactureCheck",
  description: "Gérez votre abonnement et votre quota mensuel.",
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function UsageBar({
  used,
  limit,
}: {
  used: number;
  limit: number | null;
}) {
  if (limit === null) {
    return (
      <p className="text-sm text-gray-500">
        <span className="font-medium text-gray-900">{used}</span> factures
        envoyées ce mois — illimité
      </p>
    );
  }

  const pct = Math.min((used / limit) * 100, 100);
  const isWarning = pct >= 80;
  const isFull = pct >= 100;

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-gray-500">
        <span className="font-medium text-gray-900">{used}</span> /{" "}
        <span className="font-medium text-gray-900">{limit}</span> factures ce
        mois
      </p>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all",
            isFull
              ? "bg-red-500"
              : isWarning
              ? "bg-amber-400"
              : "bg-blue-500",
          ].join(" ")}
          style={{ width: `${pct}%` }}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
          role="progressbar"
        />
      </div>
      {isFull && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Quota atteint — passez à un plan supérieur pour continuer.
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const profile = await getUserProfile();
  const params = await searchParams;

  const currentStatus = profile?.subscription_status ?? "free";
  const used = profile?.invoices_used_this_month ?? 0;
  const limit = profile?.invoices_limit ?? 3;

  const currentPlan = PLANS.find((p) => p.id === currentStatus) ?? PLANS[0];

  return (
    <div className="space-y-10">
      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonnement</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Gérez votre plan et suivez votre consommation mensuelle.
        </p>
      </div>

      {/* ── Notifications retour Stripe ── */}
      {params.success && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle className="h-5 w-5 shrink-0" aria-hidden />
          <span>
            Abonnement activé avec succès. Votre quota a été mis à jour.
          </span>
        </div>
      )}
      {params.canceled && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
          <span>Paiement annulé. Aucun changement n'a été effectué.</span>
        </div>
      )}

      {/* ── Plan actuel + usage ── */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-blue-500" aria-hidden />
          <h2 className="text-base font-semibold text-gray-900">
            Plan actuel :{" "}
            <span className="text-blue-600">{currentPlan.name}</span>
          </h2>
        </div>

        <UsageBar used={used} limit={limit} />

        {profile?.stripe_customer_id && currentStatus !== "free" && (
          <BillingActions mode="portal" />
        )}
      </section>

      {/* ── Comparatif des plans ── */}
      <section aria-labelledby="plans-heading">
        <h2
          id="plans-heading"
          className="text-base font-semibold text-gray-900 mb-4"
        >
          Changer de plan
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentStatus;
            const isUpgrade =
              (currentStatus === "free" &&
                (plan.id === "starter" || plan.id === "pro")) ||
              (currentStatus === "starter" && plan.id === "pro") ||
              (currentStatus === "canceled" &&
                (plan.id === "starter" || plan.id === "pro"));

            return (
              <div
                key={plan.id}
                className={[
                  "rounded-2xl border p-5 flex flex-col gap-4",
                  isCurrent
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-100 bg-white shadow-sm",
                ].join(" ")}
              >
                {/* En-tête plan */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {plan.name}
                    </span>
                    {isCurrent && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        Actuel
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {plan.priceEur === 0 ? (
                      "Gratuit"
                    ) : (
                      <>
                        {plan.priceEur}&nbsp;€
                        <span className="text-sm font-normal text-gray-400">
                          /mois
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <CheckCircle
                        className="h-4 w-4 text-green-500 mt-0.5 shrink-0"
                        aria-hidden
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Action */}
                {isUpgrade && plan.id !== "free" && (
                  <BillingActions
                    mode="checkout"
                    planId={plan.id as "starter" | "pro"}
                  />
                )}
                {isCurrent && (
                  <p className="text-xs text-center text-gray-400 pt-1">
                    Votre plan actuel
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
