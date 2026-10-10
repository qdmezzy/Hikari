import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePublicStats } from '../src/lib/public-profile-stats.mjs'

test('shared totals omit hidden titles without exposing activity rows', () => {
  const stats = calculatePublicStats([
    { status: 'watching', progress: 3, score: 8, media_type: 'ANIME', updated_at: '2026-10-10T12:00:00Z' },
    { status: 'completed', progress: 12, score: 10, media_type: 'ANIME', hide_from_profile: true, finished_at: '2026-10-10T12:00:00Z' },
  ], new Date('2026-10-10T14:00:00Z'))
  assert.equal(stats.watching, 1)
  assert.equal(stats.completed, 0)
  assert.equal(stats.totalTitles, 1)
  assert.equal(stats.totalProgress, 3)
  assert.equal(stats.meanScore, 8)
  assert.equal(stats.currentStreak, 1)
})
