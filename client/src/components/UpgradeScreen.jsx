import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

const SUBSCRIPTION_PRICE_USDC = 0.1;
const SUBSCRIPTION_DURATION_DAYS = 30;

const PRO_FEATURES = [
  "Full access to Pro features",
  "Priority support",
  "Cancel anytime"
];

function truncateAddress(address) {
  if (!address || address.length < 8) return address || "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function UpgradeScreen({ onBack }) {
  const endpoint = useMemo(
    () => import.meta.env.VITE_HELIUS_DEVNET_RPC || clusterApiUrl("devnet"),
    []
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <UpgradeContent onBack={onBack} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function UpgradeContent({ onBack }) {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState(null);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      setBalanceError(null);
      return;
    }
    let cancelled = false;
    setBalance(null);
    setBalanceError(null);
    connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
      })
      .catch((err) => {
        if (!cancelled) {
          setBalanceError(err?.message || "Could not load balance");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey]);

  const address = publicKey?.toBase58();

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

          <div className="mt-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              Make sure Phantom is set to <strong>Solana Devnet</strong> before
              connecting.
            </span>
          </div>

          {!connected ? (
            <div className="mt-5 flex flex-col items-center gap-2">
              <WalletMultiButton />
              {connecting && (
                <p className="text-xs text-stone-500">Connecting...</p>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Connected wallet
                    </p>
                    <p className="mt-0.5 truncate font-mono text-sm text-ink">
                      {truncateAddress(address)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-coral hover:text-coral"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-sm">
                  <span className="text-stone-600">Devnet balance</span>
                  <span className="font-semibold text-ink">
                    {balanceError
                      ? "—"
                      : balance === null
                        ? "Loading..."
                        : `${balance.toFixed(4)} SOL`}
                  </span>
                </div>
                {balanceError && (
                  <p className="mt-2 text-xs text-coral">{balanceError}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="w-full cursor-not-allowed rounded-md bg-stone-200 px-4 py-3 text-sm font-semibold text-stone-500"
                >
                  Pay {SUBSCRIPTION_PRICE_USDC} USDC
                </button>
                <p className="text-center text-xs text-stone-500">
                  Coming in next step
                </p>
              </div>
            </div>
          )}

          <p className="mt-6 border-t border-stone-100 pt-4 text-center text-xs text-stone-500">
            You'll be paying with USDC on Solana Devnet
          </p>
        </div>
      </section>
    </main>
  );
}
