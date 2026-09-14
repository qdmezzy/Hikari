import test from 'node:test'
import assert from 'node:assert/strict'
import { readAllRows } from '../src/lib/read-all-rows.mjs'
function source(rows, { cap = 250, failAfter = Infinity } = {}) {
  let calls = 0
  return () => {
    let key, cursor, limit
    const q = { order(k, direction) { key=k; assert.equal(direction.ascending,true); return q }, limit(n) { limit=n; return q }, gt(k,v) { assert.equal(k,key); cursor=v; return q }, then(resolve) {
      calls++
      resolve(calls > failAfter ? {data:null,error:new Error('Offline')} : {data:rows.filter(r => cursor === undefined || r[key] > cursor).slice(0,Math.min(limit,cap)),error:null})
    } }
    return q
  }
}
test('reads beyond 1000 rows and honors a lower server page cap', async () => {
  const rows = Array.from({length:1203},(_,i)=>({media_id:i+1}))
  const result = await readAllRows(source(rows,{cap:100}),{key:'media_id'})
  assert.equal(result.error,null)
  assert.deepEqual(result.data,rows)
})
test('a failed later page never returns partial rows as a complete collection', async () => {
  const result = await readAllRows(source([{id:1},{id:2}],{cap:1,failAfter:1}))
  assert.equal(result.data,null)
  assert.match(result.error.message,/Offline/)
})
test('empty collections are successful and cancelled reads stop immediately', async () => {
  assert.deepEqual(await readAllRows(source([])),{data:[],error:null})
  const result = await readAllRows(() => assert.fail('must not query'),{isActive:()=>false})
  assert.match(result.error.message,/cancelled/)
})
test('non-advancing responses and excessive reads fail closed', async () => {
  const repeat = () => { const q = {order:()=>q,limit:()=>q,gt:()=>q,then:resolve=>resolve({data:[{id:1}],error:null})};return q }
  assert.equal((await readAllRows(repeat)).data,null)
  const result = await readAllRows(source([{id:1},{id:2}],{cap:1}),{maxPages:1})
  assert.match(result.error.message,/too large/)
})
