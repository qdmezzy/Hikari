import test from 'node:test'
import assert from 'node:assert/strict'
import { createCollectionWithTitle } from '../src/lib/collection-save.mjs'

const list = { id: 'list', name: 'Tonight', is_public: false }
function database(createError, addResult) {
  return { from(table) {
    if (table === 'custom_lists') return { insert(row) {
      assert.equal(row.is_public, false)
      return { select: () => ({ single: async () => ({ data: createError ? null : list, error: createError }) }) }
    } }
    return { insert: async row => { assert.equal(row.list_id, list.id); return addResult() } }
  } }
}
test('collection creation failure rejects before adding a title', async () => {
  await assert.rejects(createCollectionWithTitle(database(true, () => assert.fail()), 'user', 'Tonight', 1))
})
test('failed title insertion preserves the collection without claiming membership', async () => {
  for (const add of [() => ({ error: { message: 'denied' } }), () => { throw new Error('offline') }]) {
    assert.deepEqual(await createCollectionWithTitle(database(null, add), 'user', 'Tonight', 1), { list, added: false })
  }
})
test('only successful insertion confirms collection membership', async () => {
  assert.deepEqual(await createCollectionWithTitle(database(null, () => ({ error: null })), 'user', 'Tonight', 1), { list, added: true })
})
