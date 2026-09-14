import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { processPushJob } from '../src/lib/push-job.mjs'
const now = Date.parse('2026-09-06T12:00:00Z')
const job = { id: 'job', lease_token: 'lease', media_id: 1, episode: 2, title: 'Test title', attempts: 1, airing_at: new Date(now).toISOString() }
function adapter(overrides = {}) {
  const receipts = [], sent = []
  return { receipts, sent, currentSubscription: async () => ({ endpoint: 'test-only' }),
    send: async (_subscription, payload) => { sent.push(payload) },
    finish: async (job, state, code) => { receipts.push({ state, code }) }, ...overrides }
}
test('push job confirms provider acceptance and uses an episode-specific tag', async () => {
  const a = adapter()
  assert.equal(await processPushJob(job, a, now), 'sent')
  assert.equal(a.sent[0].tag, 'airing-1-2')
  assert.equal(a.receipts[0].state, 'sent')
})
test('fresh opt-out cancels a queued delivery without sending', async () => {
  const a = adapter({ currentSubscription: async () => null })
  assert.equal(await processPushJob(job, a, now), 'cancelled')
  assert.equal(a.sent.length, 0)
})
test('lookup errors never become a send or permanent opt-out', async () => {
  const a = adapter({ currentSubscription: async () => { throw new Error('private database detail') } })
  assert.equal(await processPushJob(job, a, now), 'pending')
  assert.equal(a.sent.length, 0)
  assert.equal(a.receipts[0].code, 'transport_or_lookup')
})
test('provider failures separate transient, expired and terminal cases', async () => {
  for (const [statusCode, state] of [[429,'pending'],[503,'pending'],[408,'pending'],[404,'cancelled'],[410,'cancelled'],[400,'dead']]) {
    const a = adapter({ send: async () => { throw { statusCode } } })
    assert.equal(await processPushJob(job, a, now), state)
  }
})
test('old or exhausted jobs do not send; delayed notification copy is honest', async () => {
  for (const old of [{ ...job, airing_at: new Date(now - 86400001).toISOString() }, { ...job, attempts: 7 }]) {
    const a = adapter()
    assert.equal(await processPushJob(old, a, now), 'dead')
    assert.equal(a.sent.length, 0)
  }
  const a = adapter()
  await processPushJob({ ...job, airing_at: new Date(now - 3600000).toISOString() }, a, now)
  assert.match(a.sent[0].body, /has aired/)
})
test('receipt failure is not reported as successful delivery', async () => {
  await assert.rejects(processPushJob(job, adapter({ finish: async () => { throw new Error('stale lease') } }), now), /stale lease/)
})
test('queue migration fences receipts, deduplicates devices and denies client access', () => {
  const sql = readFileSync(new URL('../db/migrations/20260906_09_push_delivery.sql', import.meta.url), 'utf8')
  assert.match(sql, /FOR UPDATE SKIP LOCKED/)
  assert.match(sql, /lease_token=p_token/)
  assert.match(sql, /ON CONFLICT \(user_id,media_id,episode,endpoint_hash\) DO NOTHING/)
  assert.match(sql, /FROM PUBLIC, anon, authenticated/)
})
