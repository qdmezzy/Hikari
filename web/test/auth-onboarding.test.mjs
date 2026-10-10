import test from 'node:test'
import assert from 'node:assert/strict'
import { needsAuthOnboarding } from '../src/lib/auth-onboarding.js'

test('an already linked Discord account with a Hikari handle goes to the site', () => {
  const user = { app_metadata: { providers: ['email', 'discord'] }, user_metadata: { username: 'rays' } }
  assert.equal(needsAuthOnboarding(user), false)
})

test('a new social account without a Hikari handle still needs setup', () => {
  const user = { app_metadata: { providers: ['discord'] }, user_metadata: {} }
  assert.equal(needsAuthOnboarding(user), true)
})

test('an automatically provisioned handle does not skip new social onboarding', () => {
  const user = { app_metadata: { providers: ['discord'] }, user_metadata: { username: 'newfan' } }
  assert.equal(needsAuthOnboarding(user), true)
})
