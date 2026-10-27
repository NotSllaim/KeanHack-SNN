import assert from 'node:assert/strict';
import { test, beforeEach, afterEach, mock } from 'node:test';
import { PublicKey } from '@solana/web3.js';
import { verifyUsdcPayment } from '../src/services/solanaVerification.js';
import { applyVerifiedPayment } from '../src/services/subscriptionService.js';
import { User } from '../src/models/User.js';

const publicKey = n => new PublicKey(new Uint8Array(32).fill(n));
const sender = publicKey(1).toBase58();
const merchant = publicKey(2).toBase58();
const mint = publicKey(3).toBase58();
const userId = '123456789012345678901234';
const args = { signature: 'test-signature', expectedSenderWallet: sender, expectedUserId: userId };
const config = { MERCHANT_WALLET: merchant, USDC_MINT_DEVNET: mint, SUBSCRIPTION_PRICE_USDC: '0.1', SUBSCRIPTION_DURATION_DAYS: '30' };
let saved;
beforeEach(() => {
  saved = Object.fromEntries(Object.keys(config).map(k => [k, process.env[k]]));
  Object.assign(process.env, config);
  for (const method of ['log', 'warn', 'error']) mock.method(console, method, () => {});
});
afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  mock.restoreAll();
});

function fixture(checked = false) {
  return {
    blockTime: 1700000000,
    transaction: { message: {
      accountKeys: [
        { pubkey: publicKey(1), signer: true },
        { pubkey: publicKey(4), signer: false },
        { pubkey: publicKey(5), signer: false }
      ],
      instructions: [
        { program: 'spl-token', parsed: { type: checked ? 'transferChecked' : 'transfer', info: {
          authority: sender, source: publicKey(4).toBase58(), destination: publicKey(5).toBase58(),
          amount: '100000', tokenAmount: { amount: '100000', decimals: 6, uiAmount: 0.1 }
        } } },
        { programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), parsed: `lingo:subscription:${userId}` }
      ]
    } },
    meta: {
      err: null,
      preTokenBalances: [{ accountIndex: 1, owner: sender, mint }],
      postTokenBalances: [{ accountIndex: 2, owner: merchant, mint }]
    }
  };
}
const rpc = tx => ({ getGenesisHash: async () => 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', getParsedTransaction: async () => tx });

test('accepts exact-price account-bound transfers, including a newly created destination ATA', async () => {
  for (const checked of [false, true]) {
    const result = await verifyUsdcPayment(args, rpc(fixture(checked)));
    assert.equal(result.valid, true);
    assert.equal(result.details.amount, 0.1);
    assert.equal(result.details.userId, userId);
  }
});

test('rejects failed, missing, underpaid, wrong-token and wrong-recipient payments', async () => {
  assert.equal((await verifyUsdcPayment(args, rpc(null))).valid, false);
  const changes = [
    tx => { tx.meta.err = { InstructionError: [0, 'InsufficientFunds'] }; },
    tx => { tx.transaction.message.instructions[0].parsed.info.amount = '99999'; },
    tx => { tx.meta.postTokenBalances[0].mint = publicKey(9).toBase58(); },
    tx => { tx.meta.postTokenBalances[0].owner = sender; },
    tx => { tx.meta.preTokenBalances[0].owner = merchant; },
    tx => { tx.transaction.message.instructions[0].parsed.info.authority = merchant; },
    tx => { tx.transaction.message.instructions[0].parsed.info.amount = 'malformed'; }
  ];
  for (const change of changes) {
    const tx = fixture(); change(tx);
    assert.equal((await verifyUsdcPayment(args, rpc(tx))).valid, false);
  }
});

test('public transaction details cannot be claimed by another account or unsigned sender', async () => {
  assert.equal((await verifyUsdcPayment({ ...args, expectedUserId: '999999999999999999999999' }, rpc(fixture()))).valid, false);
  const unsigned = fixture(); unsigned.transaction.message.accountKeys[0].signer = false;
  assert.equal((await verifyUsdcPayment(args, rpc(unsigned))).valid, false);
  const legacy = fixture(); legacy.transaction.message.instructions.pop();
  assert.equal((await verifyUsdcPayment(args, rpc(legacy))).valid, false);
});

test('rejects non-devnet RPCs before transaction lookup and hides RPC error URLs', async () => {
  const connection = rpc(fixture());
  connection.getGenesisHash = async () => 'not-devnet';
  connection.getParsedTransaction = () => { throw new Error('must not fetch'); };
  assert.match((await verifyUsdcPayment(args, connection)).reason, /only accepts Solana devnet/);
  connection.getGenesisHash = async () => { throw new Error('https://example.invalid/?api-key=test-secret'); };
  const result = await verifyUsdcPayment(args, connection);
  assert.equal(result.valid, false);
  assert.doesNotMatch(result.reason, /test-secret/);
});

test('missing configuration and malformed price fail without RPC calls', async () => {
  const connection = { getGenesisHash: () => { throw new Error('must not call'); } };
  for (const price of ['', '0', '-1', '0.1junk', '0.0000001']) {
    process.env.SUBSCRIPTION_PRICE_USDC = price;
    assert.match((await verifyUsdcPayment(args, connection)).reason, /config/);
  }
});

test('same-account races and global duplicate-index errors both reject payment reuse', async () => {
  mock.method(User, 'init', async () => {});
  const update = mock.method(User, 'findOneAndUpdate', async () => null);
  const payment = { userId, signature: args.signature, walletAddress: sender, verificationDetails: { sender, userId, amount: 0.1 } };
  await assert.rejects(applyVerifiedPayment(payment), /DUPLICATE_SIGNATURE/);
  update.mock.mockImplementation(async () => { throw Object.assign(new Error('unique constraint'), { code: 11000 }); });
  await assert.rejects(applyVerifiedPayment(payment), /DUPLICATE_SIGNATURE/);
});

test('index initialization failure or mismatched verification never grants a subscription', async () => {
  const update = mock.method(User, 'findOneAndUpdate', async () => { throw new Error('must not update'); });
  mock.method(User, 'init', async () => { throw new Error('Index unavailable'); });
  const payment = { userId, signature: args.signature, walletAddress: sender, verificationDetails: { sender, userId, amount: 0.1 } };
  await assert.rejects(applyVerifiedPayment(payment), /Index unavailable/);
  await assert.rejects(applyVerifiedPayment({ ...payment, verificationDetails: { sender, userId: 'different-account', amount: 0.1 } }), /INVALID_VERIFICATION_DETAILS/);
  assert.equal(update.mock.callCount(), 0);
});
