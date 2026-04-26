import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const USDC_DECIMALS = 6;

let cachedConnection = null;
function getConnection() {
  if (cachedConnection) return cachedConnection;
  const rpc = process.env.HELIUS_DEVNET_RPC || clusterApiUrl("devnet");
  cachedConnection = new Connection(rpc, "confirmed");
  return cachedConnection;
}

function isValidPubkey(value) {
  if (!value || typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function readConfig() {
  const merchantWallet = process.env.MERCHANT_WALLET;
  const usdcMint = process.env.USDC_MINT_DEVNET;
  const priceRaw = process.env.SUBSCRIPTION_PRICE_USDC;
  const price = Number.parseFloat(priceRaw);

  const missing = [];
  if (!isValidPubkey(merchantWallet)) missing.push("MERCHANT_WALLET");
  if (!isValidPubkey(usdcMint)) missing.push("USDC_MINT_DEVNET");
  if (!Number.isFinite(price) || price <= 0) missing.push("SUBSCRIPTION_PRICE_USDC");

  return { merchantWallet, usdcMint, price, missing };
}

// getParsedTransaction returns accountKeys entries as
// { pubkey: PublicKey, signer, writable, source } — pubkey is a PublicKey
// object, NOT a base58 string. loadedAddresses entries are also PublicKey
// objects. Parsed instruction info.source/info.destination ARE base58
// strings. We must coerce everything to base58 strings before comparing,
// otherwise array.indexOf(string) returns -1.
function pubkeyOf(accountKey) {
  if (!accountKey) return null;
  if (typeof accountKey === "string") return accountKey;
  if (typeof accountKey.toBase58 === "function") return accountKey.toBase58();
  const inner = accountKey.pubkey;
  if (!inner) return null;
  if (typeof inner === "string") return inner;
  if (typeof inner.toBase58 === "function") return inner.toBase58();
  return String(inner);
}

// For v0 transactions, accounts pulled in via address lookup tables don't
// appear in message.accountKeys — they live in meta.loadedAddresses. The
// accountIndex used by pre/postTokenBalances refers to the combined list:
// staticKeys ++ loadedAddresses.writable ++ loadedAddresses.readonly.
function getAllAccountKeys(tx) {
  const staticKeys = (tx.transaction?.message?.accountKeys || []).map(pubkeyOf);
  const loaded = tx.meta?.loadedAddresses || {};
  const writable = (loaded.writable || []).map(pubkeyOf);
  const readonly = (loaded.readonly || []).map(pubkeyOf);
  return [...staticKeys, ...writable, ...readonly];
}

function findBalanceByIndex(balances, accountIndex) {
  if (!Array.isArray(balances)) return null;
  return balances.find((b) => b.accountIndex === accountIndex) || null;
}

// Walk both top-level instructions and every innerInstructions[].instructions
// group. The transfer can live in either place depending on whether the
// payment was a bare transfer or wrapped (e.g. invoked via a router/program).
function collectAllInstructions(tx) {
  const outer = (tx.transaction?.message?.instructions || []).map((ix, i) => ({
    ix,
    location: `outer[${i}]`
  }));
  const inner = [];
  for (const group of tx.meta?.innerInstructions || []) {
    const groupIxs = group.instructions || [];
    for (let i = 0; i < groupIxs.length; i++) {
      inner.push({ ix: groupIxs[i], location: `inner[parent=${group.index}][${i}]` });
    }
  }
  return [...outer, ...inner];
}

function findTokenTransferInstruction(tx) {
  return collectAllInstructions(tx).find(
    ({ ix }) =>
      ix.program === "spl-token" &&
      (ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked")
  );
}

function fail(reason, ctx) {
  if (ctx !== undefined) {
    console.error(`[solana-verify] FAIL: ${reason}`, ctx);
  } else {
    console.error(`[solana-verify] FAIL: ${reason}`);
  }
  return { valid: false, reason };
}

export async function verifyUsdcPayment({ signature, expectedSenderWallet }) {
  if (!signature || typeof signature !== "string") {
    return fail("Missing or invalid signature", { signature });
  }
  if (!isValidPubkey(expectedSenderWallet)) {
    return fail("Missing or invalid expectedSenderWallet", { expectedSenderWallet });
  }

  const config = readConfig();
  if (config.missing.length > 0) {
    return fail(`Server missing Solana config: ${config.missing.join(", ")}`);
  }

  let tx;
  try {
    tx = await getConnection().getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed"
    });
  } catch (err) {
    return fail(`RPC error fetching transaction: ${err?.message || "unknown"}`, {
      signature
    });
  }

  if (!tx) return fail("Transaction not found on-chain", { signature });
  if (tx.meta?.err !== null && tx.meta?.err !== undefined) {
    return fail("Transaction failed on-chain", { err: tx.meta.err });
  }
  if (!tx.blockTime) return fail("Transaction not finalized (no blockTime)");

  const matched = findTokenTransferInstruction(tx);
  if (!matched) {
    const summary = collectAllInstructions(tx).map(({ ix, location }) => ({
      location,
      program: ix.program,
      type: ix.parsed?.type
    }));
    return fail("No SPL token transfer instruction in transaction", {
      instructions: summary
    });
  }

  const { ix: transferIx, location } = matched;
  console.log(
    `[solana-verify] matched ${transferIx.parsed.type} at ${location} (sig=${signature.slice(0, 8)}...)`
  );

  const info = transferIx.parsed.info;
  const sourceAccount = info.source;
  const destinationAccount = info.destination;

  // Resolve indices by cross-referencing parsed account pubkeys against the
  // full key list (static + loaded). preTokenBalances/postTokenBalances index
  // into this same combined list.
  const accountKeys = getAllAccountKeys(tx);
  const sourceIndex = accountKeys.indexOf(sourceAccount);
  const destIndex = accountKeys.indexOf(destinationAccount);
  if (sourceIndex === -1 || destIndex === -1) {
    return fail("Could not resolve source/destination accounts in transaction", {
      sourceAccount,
      destinationAccount,
      sourceIndex,
      destIndex,
      accountKeysCount: accountKeys.length,
      accountKeys
    });
  }

  // Source ATA must already exist before the transfer (otherwise the transfer
  // itself would fail), so its owner is in preTokenBalances.
  const sourceBalance = findBalanceByIndex(tx.meta?.preTokenBalances, sourceIndex);
  // Destination ATA may have been created in this same transaction (common
  // when the payer's first interaction with the merchant). In that case
  // preTokenBalances has no entry for it — we must read the owner from
  // postTokenBalances.
  const destBalance = findBalanceByIndex(tx.meta?.postTokenBalances, destIndex);

  if (!sourceBalance) {
    return fail("Source token account not found in preTokenBalances", {
      sourceIndex,
      sourceAccount,
      preTokenBalances: tx.meta?.preTokenBalances
    });
  }
  if (!destBalance) {
    return fail("Destination token account not found in postTokenBalances", {
      destIndex,
      destinationAccount,
      postTokenBalances: tx.meta?.postTokenBalances
    });
  }

  const sourceOwner = sourceBalance.owner;
  const destOwner = destBalance.owner;
  console.log(
    `[solana-verify] resolved owners source=${sourceOwner} dest=${destOwner}`
  );

  if (destBalance.mint !== config.usdcMint) {
    return fail("Token mint does not match USDC", {
      destMint: destBalance.mint,
      expectedMint: config.usdcMint
    });
  }
  if (sourceBalance.mint !== config.usdcMint) {
    return fail("Source token account is not USDC", {
      sourceMint: sourceBalance.mint,
      expectedMint: config.usdcMint
    });
  }

  if (destOwner !== config.merchantWallet) {
    return fail("Recipient is not the configured merchant wallet", {
      destOwner,
      expectedMerchant: config.merchantWallet
    });
  }
  if (sourceOwner !== expectedSenderWallet) {
    return fail("Sender does not match the wallet provided in the request", {
      sourceOwner,
      expectedSender: expectedSenderWallet
    });
  }

  // `transfer` carries `info.amount` as a base-units string.
  // `transferChecked` carries `info.tokenAmount` = { amount, decimals, uiAmount, uiAmountString }.
  let actualRaw;
  let actualUi;
  let actualDecimals = USDC_DECIMALS;
  try {
    if (transferIx.parsed.type === "transferChecked") {
      actualRaw = BigInt(info.tokenAmount.amount);
      actualDecimals = Number(info.tokenAmount.decimals);
      actualUi =
        info.tokenAmount.uiAmount != null
          ? Number(info.tokenAmount.uiAmount)
          : Number(actualRaw) / 10 ** actualDecimals;
    } else {
      actualRaw = BigInt(info.amount);
      actualUi = Number(actualRaw) / 10 ** USDC_DECIMALS;
    }
  } catch (err) {
    return fail("Could not parse transfer amount", { info, err: err?.message });
  }

  if (actualDecimals !== USDC_DECIMALS) {
    return fail("Unexpected token decimals on transferChecked", {
      actualDecimals,
      expectedDecimals: USDC_DECIMALS
    });
  }

  const expectedRaw = BigInt(Math.round(config.price * 10 ** USDC_DECIMALS));
  if (actualRaw !== expectedRaw) {
    return fail(
      `Amount mismatch: expected ${config.price} USDC (${expectedRaw} base units), got ${actualUi} USDC (${actualRaw} base units)`,
      {
        actualRaw: actualRaw.toString(),
        expectedRaw: expectedRaw.toString(),
        actualUi,
        expectedUi: config.price
      }
    );
  }

  console.log(
    `[solana-verify] OK ${actualUi} USDC ${sourceOwner} -> ${destOwner} (sig=${signature.slice(0, 8)}...)`
  );

  return {
    valid: true,
    details: {
      sender: sourceOwner,
      recipient: destOwner,
      amount: actualUi,
      sourceTokenAccount: sourceAccount,
      destinationTokenAccount: destinationAccount,
      blockTime: tx.blockTime,
      instructionType: transferIx.parsed.type,
      instructionLocation: location
    }
  };
}
