import test from 'node:test'
import assert from 'node:assert/strict'
import {buildYearbook} from '../src/lib/wrapped-history.mjs'
const event=(patch={})=>({id:1,media_id:10,media_type:'ANIME',recorded_at:'2026-02-01T12:00:00Z',action:'updated',old_progress:10,new_progress:12,...patch})
test('yearbook ignores imported lifetime progress and counts only net recorded changes',()=>{
 const result=buildYearbook([event({action:'added',new_progress:100}),event(),event({id:2,old_progress:12,new_progress:11})],2026,new Map([[10,{format:'TV',duration:24}]]))
 assert.equal(result.episodes,1);assert.equal(result.knownMinutes,24)
})
test('yearbook separates films, manga and missing metadata without 24-minute defaults',()=>{
 const result=buildYearbook([event({old_progress:0,new_progress:1}),event({media_id:11,media_type:'MANGA',old_progress:3,new_progress:8}),event({media_id:12})],2026,new Map([[10,{format:'MOVIE',duration:130}]]))
 assert.equal(result.films,1);assert.equal(result.chapters,5);assert.equal(result.episodes,0);assert.equal(result.knownMinutes,130);assert.equal(result.unknownTypeTitles,1)
})
test('yearbook uses UTC boundaries and activity dates rather than lifetime title updates',()=>{
 const result=buildYearbook([event({recorded_at:'2025-12-31T23:30:00-02:00'}),event({recorded_at:'2026-01-02T12:00:00Z'}),event({recorded_at:'invalid'}),event({recorded_at:'2027-01-01T00:00:00Z'})],2026)
 assert.equal(result.eventCount,2);assert.equal(result.streak,2);assert.equal(result.months[0],2)
})
