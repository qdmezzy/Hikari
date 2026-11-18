import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/app/api/profiles/[handle]/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

async function requestProfile(profile) {
  const exports = {}
  const admin = {
    from(table) {
      const query = {
        select() { return query },
        eq() { return query },
        async maybeSingle() {
          return { data: table === 'public_profiles' ? { ...profile } : null, error: null }
        },
      }
      return query
    },
  }
  vm.runInNewContext(compiled, {
    exports,
    process: { env: { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-only' } },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, ...options }) } }
      if (name === '@supabase/supabase-js') return { createClient: () => admin }
      if (name === '@/lib/public-profile-stats.mjs') return { calculatePublicStats: () => { throw new Error('Unexpected list lookup') } }
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  return exports.GET({}, { params: Promise.resolve({ handle: 'test' }) })
}

test('public profile response conceals hidden favorites while retaining visible favorites', async () => {
  const profile = { user_id: 'test', public_profile: true, show_stats: false, favorite_media_ids: [20, 269] }
  const hidden = await requestProfile({ ...profile, show_favorites: false })
  assert.equal(JSON.stringify(hidden.body.profile.favorite_media_ids), '[]')
  const visible = await requestProfile({ ...profile, show_favorites: true })
  assert.deepEqual(visible.body.profile.favorite_media_ids, [20, 269])
  assert.match(hidden.headers['Cache-Control'], /no-store/)
})

test('private profile response contains no profile data', async () => {
  const result = await requestProfile({ public_profile: false, favorite_media_ids: [20] })
  assert.equal(result.status, 403)
  assert.equal(JSON.stringify(result.body), '{"state":"private"}')
})
