import React, { useState } from "react";
import { api } from "../api.js";

// Generate fake Solana addresses
function generateFakeAddress() {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let address = "";
  for (let i = 0; i < 44; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return address;
}

function generateFakeTxHash() {
  return Array.from({ length: 88 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)]
  ).join("");
}

export function SolanaUpgrade({ onUpgradeComplete, isUpgraded }) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [successfullyUpgraded, setSuccessfullyUpgraded] = useState(false);

  const handleConnectWallet = () => {
    const address = generateFakeAddress();
    setWalletAddress(address);
    setWalletConnected(true);
    setError(null);
  };

  const handleDisconnect = () => {
    setWalletConnected(false);
    setWalletAddress(null);
    setTxHash(null);
  };

  const handleUpgradeClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmUpgrade = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Generate fake transaction hash
      const hash = generateFakeTxHash();
      setTxHash(hash);

      // Simulate transaction processing delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Call backend to mark user as upgraded
      const data = await api("/auth/upgrade", {
        method: "POST",
        body: JSON.stringify({ transactionSignature: hash, walletAddress })
      });

      // This will cause the parent to re-render and pass isUpgraded=true
      // which will make this component return null
      setSuccessfullyUpgraded(true);
      onUpgradeComplete(data.user);
    } catch (err) {
      setError(err.message || "Failed to process upgrade");
      setTxHash(null);
    } finally {
      setIsProcessing(false);
      setShowConfirmation(false);
    }
  };

  if (isUpgraded) {
    return null;
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-meadow mb-3">Upgrade with Solana</p>

      <div className="flex flex-col gap-3">
        {!walletConnected ? (
          <button
            onClick={handleConnectWallet}
            className="rounded-md bg-meadow px-4 py-2 text-sm font-semibold text-white hover:bg-meadow/90 transition"
          >
            Connect Wallet
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 p-3 bg-stone-50 rounded-md border border-stone-200">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-stone-500">Connected Wallet</span>
                <span className="text-xs font-mono text-stone-700">
                  {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-xs px-2 py-1 rounded bg-stone-200 hover:bg-stone-300 text-stone-700"
              >
                Disconnect
              </button>
            </div>

            <button
              onClick={handleUpgradeClick}
              disabled={isProcessing || txHash !== null || successfullyUpgraded}
              className="rounded-md bg-meadow px-4 py-2 text-sm font-semibold text-white hover:bg-meadow/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {successfullyUpgraded ? "✓ Upgraded!" : isProcessing ? "Processing..." : "Upgrade! (0 SOL)"}
            </button>
          </>
        )}

        {showConfirmation && !txHash && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-sm w-full p-6 shadow-xl">
              <h3 className="text-lg font-bold text-ink mb-4">Confirm Transaction</h3>

              <div className="space-y-3 mb-6 bg-stone-50 p-3 rounded-md border border-stone-200">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Amount</span>
                  <span className="font-semibold">0 SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Network</span>
                  <span className="font-semibold">Solana Devnet</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Action</span>
                  <span className="font-semibold">Upgrade Account</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Fee</span>
                  <span className="font-semibold">~0.00005 SOL</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-md border border-stone-200 text-stone-700 hover:bg-stone-50 transition"
                >
                  Reject
                </button>
                <button
                  onClick={handleConfirmUpgrade}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-md bg-meadow text-white hover:bg-meadow/90 disabled:opacity-50 transition"
                >
                  {isProcessing ? "Signing..." : "Approve"}
                </button>
              </div>
            </div>
          </div>
        )}

        {txHash && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-sm w-full p-6 shadow-xl">
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">✨</div>
                <h3 className="text-lg font-bold text-ink">Upgrade Successful!</h3>
              </div>

              <div className="space-y-3 mb-6 bg-green-50 p-3 rounded-md border border-green-200">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Status</span>
                  <span className="font-semibold text-green-700">Confirmed</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-stone-600">Transaction Hash</span>
                  <span className="text-xs font-mono bg-stone-100 p-2 rounded break-all">
                    {txHash}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Network</span>
                  <span className="font-semibold">Solana Devnet</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setTxHash(null);
                  setShowConfirmation(false);
                }}
                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-meadow text-white hover:bg-meadow/90 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
