import test from 'node:test'
import assert from 'node:assert/strict'
import {deliverEpisodePush} from '../src/lib/push-delivery.mjs'
test('failed and empty deliveries never advance the episode marker',async()=>{
 assert.equal((await deliverEpisodePush([],async()=>{})).canAdvance,false)
 assert.deepEqual(await deliverEpisodePush([{endpoint:'test'}],async()=>{throw new Error('offline')}),{accepted:0,failed:1,expired:[],canAdvance:false})
})
test('partial delivery remains retryable; expired subscriptions are separated',async()=>{
 const outcome=await deliverEpisodePush([{endpoint:'ok'},{endpoint:'retry'},{endpoint:'expired'}],async sub=>{if(sub.endpoint==='retry')throw new Error('timeout');if(sub.endpoint==='expired')throw {statusCode:410}})
 assert.deepEqual(outcome,{accepted:1,failed:1,expired:['expired'],canAdvance:false})
})
test('confirmed provider acceptance can advance only without retryable failures',async()=>{
 assert.equal((await deliverEpisodePush([{endpoint:'ok'}],async()=>{})).canAdvance,true)
})
