import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMediaBatches } from '../src/lib/media-fetch.mjs'
const response = (media) => ({ok:true,json:async()=>({data:{Page:{media}}})})
test('media fetch batches at 50 and rejects duplicate or unrequested titles', async () => {
  const ids = Array.from({length:110},(_,i)=>i+1), sizes=[]
  const media = await fetchMediaBatches(ids, async batch => {
    sizes.push(batch.length)
    return response([...batch.map(id=>({id})),{id:batch[0]},{id:9999}])
  })
  assert.deepEqual(sizes,[50,50,10])
  assert.equal(media.length,110)
})
test('HTTP and GraphQL failures cannot masquerade as an empty catalog', async () => {
  await assert.rejects(fetchMediaBatches([1],async()=>({ok:false})),/unavailable/)
  await assert.rejects(fetchMediaBatches([1],async()=>({ok:true,json:async()=>({errors:[{message:'disabled'}]})})),/incomplete/)
  await assert.rejects(fetchMediaBatches([1],async()=>({ok:true,json:async()=>({data:null})})),/incomplete/)
})
test('successful empty pages are valid but a failed later batch is not success', async () => {
  assert.deepEqual(await fetchMediaBatches([1],async()=>response([])),[])
  let calls=0
  await assert.rejects(fetchMediaBatches(Array.from({length:51},(_,i)=>i+1),async()=>++calls===1?response([{id:1}]):{ok:false}),/unavailable/)
})
