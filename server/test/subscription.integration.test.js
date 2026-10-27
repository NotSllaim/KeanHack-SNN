import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { applyVerifiedPayment } from '../src/services/subscriptionService.js';

// Optional real MongoDB check. No dotenv, provider keys, or blockchain calls.
// Use a disposable local database named lingo_test_*; refuses remote databases.
const uri = process.env.TEST_MONGODB_URI;
test('atomic payment writes reject concurrent same/cross-account reuse and preserve renewals', { skip: !uri }, async () => {
  const url = new URL(uri);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /^\/lingo_test_[a-z0-9_]+$/i);
  assert.equal(url.protocol, 'mongodb:');
  await mongoose.connect(uri);
  const ids = [];
  const oldDuration = process.env.SUBSCRIPTION_DURATION_DAYS;
  const oldPrice = process.env.SUBSCRIPTION_PRICE_USDC;
  Object.assign(process.env, { SUBSCRIPTION_DURATION_DAYS: '30', SUBSCRIPTION_PRICE_USDC: '0.1' });
  try {
    await User.init();
    const stamp = new mongoose.Types.ObjectId().toString();
    const users = await User.create([1, 2].map(n => ({ name: 'Payment test', email: `${stamp}-${n}@example.test`, passwordHash: 'unused-test-hash' })));
    ids.push(...users.map(u => u._id));
    const pay = (user, signature) => applyVerifiedPayment({
      userId: user._id, signature, walletAddress: 'unit-test-wallet',
      verificationDetails: { sender: 'unit-test-wallet', userId: String(user._id), amount: 0.1 }
    });
    const same = await Promise.allSettled([pay(users[0], `${stamp}-same`), pay(users[0], `${stamp}-same`)]);
    assert.equal(same.filter(r => r.status === 'fulfilled').length, 1);
    assert.match(same.find(r => r.status === 'rejected').reason.message, /DUPLICATE_SIGNATURE/);
    const first = await User.findById(users[0]._id);
    assert.equal(first.paymentHistory.length, 1);
    assert.equal(first.tier, 'pro');
    assert.ok(first.paymentHistory[0].paidAt instanceof Date);
    const renewed = await pay(users[0], `${stamp}-renewal`);
    assert.equal(new Date(renewed.subscriptionExpiresAt) - first.subscriptionExpiresAt, 30 * 86400000);
    const cross = await Promise.allSettled(users.map(u => pay(u, `${stamp}-cross`)));
    assert.equal(cross.filter(r => r.status === 'fulfilled').length, 1);
    assert.match(cross.find(r => r.status === 'rejected').reason.message, /DUPLICATE_SIGNATURE/);
    await User.updateOne({ _id: users[1]._id }, { $set: { tier: 'pro', subscriptionExpiresAt: new Date(0) } });
    const restarted = await pay(users[1], `${stamp}-expired`);
    assert.ok(new Date(restarted.subscriptionExpiresAt).getTime() >= Date.now() + 29 * 86400000);
  } finally {
    // Delete only records created by this test, never drop a user's database.
    await User.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
    if (oldDuration === undefined) delete process.env.SUBSCRIPTION_DURATION_DAYS; else process.env.SUBSCRIPTION_DURATION_DAYS = oldDuration;
    if (oldPrice === undefined) delete process.env.SUBSCRIPTION_PRICE_USDC; else process.env.SUBSCRIPTION_PRICE_USDC = oldPrice;
  }
});
