import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

function formatExpiry(value) {
  if (!value) return "No expiration";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiration";
  return `Expires ${date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })}`;
}

function truncateWallet(address) {
  if (!address) return null;
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function DashboardScreen({ onBack, onUpgrade }) {
  const { user } = useAuth();
  const [status, setStatus] = useState({ state: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api("/me/subscription")
      .then((data) => {
        if (!cancelled) setStatus({ state: "ready", data, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus({
            state: "error",
            data: null,
            error: err.message || "Could not load subscription status"
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          <h1 className="text-2xl font-bold text-meadow">Dashboard</h1>
          <div className="w-[72px]" />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-8">
        <div className="rounded-md border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Account
          </p>
          <p className="mt-1 text-lg font-bold text-ink">{user?.name}</p>
          <p className="text-sm text-stone-600">{user?.email}</p>
        </div>

        <div className="mt-5 rounded-md border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Subscription
          </p>

          {status.state === "loading" && (
            <p className="mt-3 text-sm text-stone-600">Loading subscription status...</p>
          )}

          {status.state === "error" && (
            <div className="mt-3 rounded-md border border-coral/40 bg-coral/5 p-3">
              <p className="text-sm font-semibold text-coral">
                Couldn't load subscription
              </p>
              <p className="mt-1 text-sm text-stone-600">{status.error}</p>
            </div>
          )}

          {status.state === "ready" && (
            <SubscriptionDetails data={status.data} onUpgrade={onUpgrade} />
          )}
        </div>
      </section>
    </main>
  );
}

function SubscriptionDetails({ data, onUpgrade }) {
  const isPro = data.tier === "pro";
  const wallet = truncateWallet(data.walletAddress);

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-600">Current tier:</span>
        <span
          className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            isPro
              ? "bg-meadow text-white"
              : "border border-stone-200 bg-stone-50 text-stone-700"
          }`}
        >
          {isPro ? "Pro" : "Free"}
        </span>
        {isPro && !data.isActive && (
          <span className="text-xs font-semibold text-coral">Inactive</span>
        )}
      </div>

      {isPro && (
        <>
          <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
            <span className="text-stone-600">Renewal</span>
            <span className="font-semibold text-ink">
              {formatExpiry(data.subscriptionExpiresAt)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
            <span className="text-stone-600">Paid from wallet</span>
            <span className="font-mono text-xs text-stone-700">
              {wallet || "—"}
            </span>
          </div>
        </>
      )}

      {!isPro && (
        <button
          onClick={onUpgrade}
          className="w-full rounded-md bg-meadow px-4 py-2 text-sm font-semibold text-white transition hover:bg-meadow/90"
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
