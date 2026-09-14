import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeBrowseResults } from '../src/lib/browse-results.mjs'
test('Browse removes duplicates both across and within consecutive pages', () => {
  assert.deepEqual(mergeBrowseResults([{id:1}], [{id:1},{id:2},{id:2},{id:3}], true), [{id:1},{id:2},{id:3}])
})
test('a new Browse search replaces old results and filters invalid rows', () => {
  assert.deepEqual(mergeBrowseResults([{id:1}], [null,{id:0},{id:2},{id:2}]), [{id:2}])
})
