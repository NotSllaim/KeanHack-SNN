import React from "react";
import { ArrowLeft, Wallet } from "lucide-react";

const SUBSCRIPTION_PRICE_USDC = 0.1;
const SUBSCRIPTION_DURATION_DAYS = 30;

const PRO_FEATURES = [
  "Full access to Pro features",
  "Priority support",
  "Cancel anytime"
];

export function UpgradeScreen({ onBack }) {
  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <header className="border-b border-stone-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:border-meadow hover:text-meadow"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="text-2xl font-bold text-meadow">Upgrade</h1>
          <div className="w-[72px]" />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-8">
        <div className="rounded-md border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Pro plan
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Upgrade to Pro</h2>
          <p className="mt-2 text-sm text-stone-600">
            Your subscription is paid in USDC on Solana. It costs{" "}
            <span className="font-semibold text-ink">
              {SUBSCRIPTION_PRICE_USDC} USDC
            </span>{" "}
            for{" "}
            <span className="font-semibold text-ink">
              {SUBSCRIPTION_DURATION_DAYS} days
            </span>{" "}
            of Pro access.
          </p>

          <div className="mt-5 rounded-md border border-stone-200 bg-skyglass/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              What's included
            </p>
            <ul className="mt-2 space-y-2">
              {PRO_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-stone-700"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-meadow" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-stone-200 px-4 py-3 text-sm font-semibold text-stone-500"
            >
              <Wallet size={16} />
              Connect Wallet
            </button>
            <p className="text-center text-xs text-stone-500">
              Coming in next step
            </p>
          </div>

          <p className="mt-6 border-t border-stone-100 pt-4 text-center text-xs text-stone-500">
            You'll be paying with USDC on Solana Devnet
          </p>
        </div>
      </section>
    </main>
  );
}
