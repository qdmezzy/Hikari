import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { saveEpisodeReminder } from "../src/lib/reminder-contract.mjs"
import { buildScheduleWeek, validTimeZone } from "../src/lib/schedule-domain.mjs"
import { mediaLengthLabel } from "../src/lib/media-label.mjs"
import { collectionExport } from "../src/lib/export-library.mjs"

test("reminder errors reject instead of claiming a saved state", async () => {
  const db={from:()=>({upsert:async()=>({error:{message:"denied"}})})}
  await assert.rejects(saveEpisodeReminder(db,"user",10,true),/wasn't saved/)
  await assert.rejects(saveEpisodeReminder(db,"user",0,true),/Invalid reminder/)
})
test("reminder insert is idempotent and doesn't reset notification history", async () => {
  let options
  const db={from:()=>({upsert:async(row,opts)=>{options=opts;assert.deepEqual(row,{user_id:"user",media_id:10});return{error:null}}})}
  assert.equal(await saveEpisodeReminder(db,"user",10,true),true)
  assert.equal(options.ignoreDuplicates,true)
})
test("reminder removal is scoped to both account and title", async () => {
  const filters=[]
  const query={delete(){return this},eq(key,value){filters.push([key,value]);return this},then(resolve){resolve({error:null})}}
  await saveEpisodeReminder({from:()=>query},"user",10,false)
  assert.deepEqual(filters,[["user_id","user"],["media_id",10]])
})
test("schedule groups an episode by the selected timezone, not the machine timezone", () => {
  const now=new Date("2026-09-06T01:00:00Z")
  const items=[{id:1,airingAt:Date.parse("2026-09-06T04:00:00Z")/1000}]
  assert.equal(buildScheduleWeek(items,"America/Los_Angeles",now).week[0].items.length,1)
  assert.equal(buildScheduleWeek(items,"Asia/Tokyo",now).week[0].items.length,1)
  assert.notEqual(buildScheduleWeek(items,"America/Los_Angeles",now).week[0].key,buildScheduleWeek(items,"Asia/Tokyo",now).week[0].key)
})
test("schedule keeps seven distinct days across DST and excludes past episodes", () => {
  const week=buildScheduleWeek([{id:1,airingAt:1}],"America/New_York",new Date("2026-11-01T05:30:00Z"))
  assert.equal(new Set(week.week.map(day=>day.key)).size,7)
  assert.equal(week.later.length,0)
  assert.equal(validTimeZone("not/a/zone"),false)
})
test("media labels distinguish films, chapters and unknown counts", () => {
  assert.equal(mediaLengthLabel({format:"MOVIE",episodes:1,duration:130}),"Film · 130 min")
  assert.equal(mediaLengthLabel({type:"MANGA",chapters:1,episodes:12}),"1 chapter")
  assert.equal(mediaLengthLabel({type:"ANIME",episodes:null}),"Episodes unannounced")
})
test("collection export is portable and omits account/private operational fields", () => {
  const result=collectionExport({name:"My shelf",description:"Notes",user_id:"private-user"},[{media_id:1,media_type:"ANIME",id:"private-row"}])
  assert.equal(result.version,1)
  assert.equal(result.titles[0].anilistId,1)
  assert.doesNotMatch(JSON.stringify(result),/private-user|private-row/)
})
test("moderation migration locks and checks stale state before writing", () => {
  const sql=readFileSync(new URL("../db/migrations/20260906_01_atomic_moderation.sql",import.meta.url),"utf8")
  assert.match(sql,/FOR UPDATE/)
  assert.match(sql,/item.status IS DISTINCT FROM expected_status/)
  assert.match(sql,/public.is_moderator\(\)/)
  assert.match(sql,/INSERT INTO public.moderation_decisions/)
  assert.match(sql,/REVOKE ALL ON FUNCTION/)
  const service=readFileSync(new URL("../src/lib/admin-service.js",import.meta.url),"utf8")
  assert.match(service,/rpc\("decide_social_report"/)
  assert.doesNotMatch(service,/from\(REMOVABLE_TABLES/)
})
test("Discover mounts no background player while its dialog is active or page hidden", () => {
  const screen=readFileSync(new URL("../src/components/discover/DiscoverScreen.tsx",import.meta.url),"utf8")
  assert.match(screen,/pageVisible && !m.isTrailerPlayerOpen/)
  assert.match(screen,/mode="wait"/)
  assert.match(screen,/visibilitychange/)
})
