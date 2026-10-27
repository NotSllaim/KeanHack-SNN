import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { buildProgress, awardActivityXp } from '../src/utils/xp.js';
import { refreshUserAverages } from '../src/utils/scoreAverages.js';
import { isSubscriptionActive } from '../src/utils/subscription.js';
import { User } from '../src/models/User.js';
import { Activity } from '../src/models/Activity.js';
import { mock } from 'node:test';

afterEach(() => mock.restoreAll());

test('XP level boundaries and invalid input remain bounded', () => {
  for (const [xp, level, percent] of [[0,1,0],[99,1,99],[100,2,0],[175,2,50],[249,2,99],[250,3,100],[999,3,100]]) {
    const progress = buildProgress(xp);
    assert.equal(progress.level, level);
    assert.equal(progress.progressPercent, percent);
  }
  for (const input of [-20, undefined, 'not-a-number']) assert.equal(buildProgress(input).xp, 0);
});

test('a completed reading session crosses the level threshold and awards 25 XP', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ progress: { xp: 90 } }) }));
  let update;
  mock.method(User, 'findByIdAndUpdate', (_id, value) => {
    update = value;
    return { select: async () => ({ progress: { xp: 115, level: 2 } }) };
  });
  const result = await awardActivityXp('demo-user', 'reading');
  assert.equal(result.xpAwarded, 25);
  assert.equal(result.leveledUp, true);
  assert.equal(result.progress.level, 2);
  assert.equal(update.$inc['progress.xp'], 25);
});

test('averages round across saved activities and empty history does not write', async () => {
  const activities = [{ scores: { confidence: 70, clarity: 80 } }, { scores: { confidence: 81, clarity: 91 } }];
  mock.method(Activity, 'find', () => ({ select: async () => activities }));
  const update = mock.method(User, 'findByIdAndUpdate', async () => null);
  await refreshUserAverages('demo-user');
  assert.deepEqual(update.mock.calls[0].arguments[1], {
    'scores.confidenceAverage': 76, 'scores.clarityAverage': 86, 'scores.sessionsCompleted': 2
  });
  activities.length = 0;
  await refreshUserAverages('demo-user');
  assert.equal(update.mock.callCount(), 1);
});

test('Pro status requires a valid future expiry, including legacy accounts', () => {
  mock.method(Date, 'now', () => 1000);
  assert.equal(isSubscriptionActive('pro', new Date(1001)), true);
  for (const expiry of [null, undefined, 'invalid', new Date(999), new Date(1000)]) {
    assert.equal(isSubscriptionActive('pro', expiry), false);
  }
  assert.equal(isSubscriptionActive('free', new Date(2000)), false);
});
