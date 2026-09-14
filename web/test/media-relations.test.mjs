import test from 'node:test'
import assert from 'node:assert/strict'
import { mediaRelations } from '../src/lib/media-relations.mjs'

test('relationships keep provider order and distinguish recaps from films', () => {
  const result = mediaRelations([
    {relationType:'SEQUEL',node:{id:2,title:{english:'Later'},format:'TV',startDate:{year:2024}}},
    {relationType:'SUMMARY',node:{id:1,title:{romaji:'Recap'},format:'MOVIE'}},
  ])
  assert.deepEqual(result.map(item=>[item.id,item.relation,item.format,item.year]),[[2,'Sequel','Anime',2024],[1,'Recap','Film',null]])
})

test('relationships reject missing, duplicate and adult records without inventing labels', () => {
  assert.deepEqual(mediaRelations(),[])
  const result = mediaRelations([null,{node:{id:-1}},{node:{id:1,isAdult:true}},{relationType:'FUTURE_ENUM',node:{id:2}},{node:{id:2}}])
  assert.equal(result.length,1)
  assert.equal(result[0].relation,'Related title')
  assert.equal(result[0].year,null)
})
