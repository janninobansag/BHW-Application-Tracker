import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationReadStore } from '../Services/notification-read-state.ts';

const today = '2026-11-20';
const notice = `child-1:${today}`;
const otherNotice = `child-2:${today}`;
function fixture() {
  const accounts = new Map();
  const values = new Map();
  let fail = false;
  let activeUser = 'worker-1';
  const writes = [];
  const fetch = async (_url, options = {}) => {
    if (fail) throw new Error('Network unavailable');
    const saved = accounts.get(activeUser) ?? new Set();
    if (options.method === 'PUT') {
      const { ids } = JSON.parse(options.body);
      writes.push(ids);
      ids.forEach(id => saved.add(id));
      accounts.set(activeUser, saved);
    }
    return Response.json({ userId: activeUser, readIds: [...saved] });
  };
  const create = (userId = 'worker-1', blockedStorage = false) => createNotificationReadStore(userId, {
    fetch,
    now: () => new Date(`${today}T12:00:00Z`),
    storage: () => { if (blockedStorage) throw new Error('Storage blocked'); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; },
  });
  return { create, accounts, values, writes, setFailure: value => { fail = value; }, setUser: value => { activeUser = value; } };
}

test('read notices survive login and a new browser without marking new notices read', async () => {
  const f = fixture();
  const first = f.create();
  assert.equal(first.getSnapshot().loaded, false, 'do not show unread badges before loading account receipts');
  await first.start();
  await first.markRead([notice]);
  f.values.clear(); // New browser or cleared browser storage.
  const second = f.create();
  await second.start();
  assert.deepEqual(second.getSnapshot().readIds, [notice]);
  assert.equal(second.getSnapshot().readIds.includes(otherNotice), false);
  await second.markRead([notice]);
  assert.equal(f.writes.length, 1, 'already read notifications do not generate repeated writes');
});

test('offline reads retry on reconnect and preserve legacy browser receipts', async () => {
  const f = fixture();
  f.values.set('bhw-age-notifications:worker-1', JSON.stringify([notice, 'old-child:2026-01-01', { bad: true }]));
  const store = f.create();
  f.setFailure(true);
  await store.start();
  await store.markRead([otherNotice]);
  assert.deepEqual(store.getSnapshot().readIds, [notice, otherNotice]);
  assert.ok(store.getSnapshot().error);
  f.setFailure(false);
  await store.refresh();
  assert.equal(store.getSnapshot().error, '');
  assert.deepEqual([...f.accounts.get('worker-1')].sort(), [notice, otherNotice]);
});

test('browser storage failures still save reads to the account', async () => {
  const f = fixture();
  const store = f.create('worker-1', true);
  await store.start();
  await store.markRead([notice]);
  assert.deepEqual([...f.accounts.get('worker-1')], [notice]);
});

test('read receipts remain isolated between accounts', async () => {
  const f = fixture();
  const first = f.create();
  await first.start();
  await first.markRead([notice]);
  f.setUser('worker-2');
  const second = f.create('worker-2');
  await second.start();
  assert.deepEqual(second.getSnapshot().readIds, []);
  const wrongSession = f.create('worker-1');
  await wrongSession.start();
  assert.equal(wrongSession.getSnapshot().loaded, false);
  assert.match(wrongSession.getSnapshot().error, /Sign in again/);
});

test('a read arriving while receipts load is included in the same sync', async () => {
  const f = fixture();
  const store = f.create();
  const starting = store.start();
  store.markRead([notice]);
  store.markRead([otherNotice]);
  await starting;
  assert.deepEqual([...f.accounts.get('worker-1')].sort(), [notice, otherNotice]);
});
