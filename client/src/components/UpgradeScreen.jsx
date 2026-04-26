import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  XCircle
} from "lucide-react";
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
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  clusterApiUrl
} from "@solana/web3.js";
import {
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress
} from "@solana/spl-token";

import { api } from "../api.js";

import "@solana/wallet-adapter-react-ui/styles.css";

const SUBSCRIPTION_DURATION_DAYS = 30;
const USDC_DECIMALS = 6;

const PRO_FEATURES = [
  "Full access to Pro features",
  "Priority support",
  "Cancel anytime"
];

const MERCHANT_WALLET_RAW = import.meta.env.VITE_MERCHANT_WALLET;
const USDC_MINT_RAW = import.meta.env.VITE_USDC_MINT_DEVNET;
const PRICE_RAW = import.meta.env.VITE_SUBSCRIPTION_PRICE_USDC;
const PRICE = Number.parseFloat(PRICE_RAW);

function isValidPubkey(value) {
  if (!value || typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function getMissingConfig() {
  const missing = [];
  if (!isValidPubkey(MERCHANT_WALLET_RAW)) missing.push("VITE_MERCHANT_WALLET");
  if (!isValidPubkey(USDC_MINT_RAW)) missing.push("VITE_USDC_MINT_DEVNET");
  if (!Number.isFinite(PRICE) || PRICE <= 0) {
    missing.push("VITE_SUBSCRIPTION_PRICE_USDC");
  }
  return missing;
}

function truncateAddress(address) {
  if (!address || address.length < 8) return address || "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function truncateSignature(sig) {
  if (!sig || sig.length < 16) return sig || "";
  return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
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
  const { publicKey, connected, connecting, disconnect, signTransaction } =
    useWallet();
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState(null);

  const [payState, setPayState] = useState("idle");
  const [signature, setSignature] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const missingConfig = useMemo(() => getMissingConfig(), []);
  const configOk = missingConfig.length === 0;

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
  const priceLabel = Number.isFinite(PRICE) && PRICE > 0 ? PRICE : "—";

  function resetPay() {
    setPayState("idle");
    setSignature(null);
    setErrorMessage(null);
  }

  async function handlePay() {
    if (!publicKey || !signTransaction || !configOk) return;

    setErrorMessage(null);
    setSignature(null);
    setPayState("preparing");

    let sig = null;
    try {
      const merchantPubkey = new PublicKey(MERCHANT_WALLET_RAW);
      const mintPubkey = new PublicKey(USDC_MINT_RAW);
      const amount = BigInt(Math.round(PRICE * 10 ** USDC_DECIMALS));

      const [userAta, merchantAta] = await Promise.all([
        getAssociatedTokenAddress(mintPubkey, publicKey),
        getAssociatedTokenAddress(mintPubkey, merchantPubkey)
      ]);

      const tx = new Transaction();

      let merchantAtaExists = true;
      try {
        await getAccount(connection, merchantAta);
      } catch (err) {
        if (err instanceof TokenAccountNotFoundError) {
          merchantAtaExists = false;
        } else {
          throw err;
        }
      }
      if (!merchantAtaExists) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            merchantAta,
            merchantPubkey,
            mintPubkey
          )
        );
      }

      tx.add(
        createTransferInstruction(userAta, merchantAta, publicKey, amount)
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = publicKey;

      setPayState("awaiting-approval");
      const signed = await signTransaction(tx);

      setPayState("submitting");
      sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed"
      });

      setPayState("confirming");
      const result = await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        },
        "confirmed"
      );

      if (result.value.err) {
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(result.value.err)}`
        );
      }

      console.log("[upgrade] payment signature:", sig);
      console.log(
        "[upgrade] explorer:",
        `https://explorer.solana.com/tx/${sig}?cluster=devnet`
      );
    } catch (err) {
      console.error("[upgrade] payment error:", err);
      setErrorMessage(err?.message || "Payment failed");
      setPayState("error");
      return;
    }

    setPayState("verifying");
    try {
      const verifyResp = await api("/subscription/verify", {
        method: "POST",
        body: JSON.stringify({
          signature: sig,
          walletAddress: publicKey.toBase58()
        })
      });
      if (!verifyResp?.valid) {
        throw new Error(verifyResp?.reason || "Backend reported invalid");
      }
      console.log("[upgrade] backend verified:", verifyResp.details);
      setSignature(sig);
      setPayState("success");
    } catch (err) {
      console.error("[upgrade] verification error:", err);
      const reason = err?.message || "Unknown error";
      setErrorMessage(
        `Payment was on-chain but backend verification failed: ${reason}`
      );
      setPayState("error");
    }
  }

  const payButtonLabel =
    payState === "preparing"
      ? "Preparing..."
      : payState === "awaiting-approval"
        ? "Approve in Phantom..."
        : payState === "submitting"
          ? "Submitting..."
          : payState === "confirming"
            ? "Confirming on-chain..."
            : payState === "verifying"
              ? "Verifying with server..."
              : configOk
                ? `Pay ${PRICE} USDC`
                : "Pay";

  const payDisabled = !configOk || payState !== "idle";

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
            <span className="font-semibold text-ink">{priceLabel} USDC</span>{" "}
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

              {payState === "success" && signature ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 flex-shrink-0 text-green-700"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-green-900">
                        Payment confirmed
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-green-800">
                        {truncateSignature(signature)}
                      </p>
                      <a
                        href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-800 underline hover:text-green-900"
                      >
                        View on Solana Explorer
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetPay}
                    className="mt-4 w-full rounded-md border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                  >
                    Done
                  </button>
                </div>
              ) : payState === "error" ? (
                <div className="rounded-md border border-coral/40 bg-coral/5 p-4">
                  <div className="flex items-start gap-2">
                    <XCircle
                      size={18}
                      className="mt-0.5 flex-shrink-0 text-coral"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-coral">
                        Payment failed
                      </p>
                      <p className="mt-1 break-words text-xs text-stone-700">
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetPay}
                    className="mt-4 w-full rounded-md bg-meadow px-3 py-2 text-sm font-semibold text-white hover:bg-meadow/90"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={payDisabled}
                    className={`w-full rounded-md px-4 py-3 text-sm font-semibold transition ${
                      payDisabled
                        ? "cursor-not-allowed bg-stone-200 text-stone-500"
                        : "bg-meadow text-white hover:bg-meadow/90"
                    }`}
                  >
                    {payButtonLabel}
                  </button>
                  {!configOk && (
                    <p className="text-center text-xs text-coral">
                      Missing config: {missingConfig.join(", ")}
                    </p>
                  )}
                </div>
              )}
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
