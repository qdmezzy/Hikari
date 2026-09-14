import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
test('publishing schema restricts ownership, serializes publishing and keeps private content out of notifications',()=>{
 const sql=read('../db/migrations/20260906_04_collection_publishing.sql')
 assert.match(sql,/user_id=auth\.uid\(\) FOR UPDATE/)
 assert.match(sql,/NOT c\.is_public/)
 assert.match(sql,/interval '1 hour'/)
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/)
 assert.match(sql,/Only the owner of a public collection/)
 const notification=sql.slice(sql.indexOf('INSERT INTO public.notifications'))
 assert.doesNotMatch(notification,/c\.name|update_note|c\.description/)
})
test('taste comparison is opt-in for both public profiles and never queries private tracking',()=>{
 const sql=read('../db/migrations/20260906_05_taste_comparison.sql')
 assert.match(sql,/DEFAULT false/)
 assert.equal((sql.match(/public_profile AND show_favorites AND allow_taste_comparison/g)||[]).length,2)
 assert.doesNotMatch(sql,/list_entries|auth\.users/)
 assert.match(sql,/REVOKE ALL.*FROM PUBLIC,anon/)
})
test('profile exposes direct favorite choice and comparison without changing visibility',()=>{
 const view=read('../src/components/profile/ProfileScreen.tsx')
 assert.match(view,/<FavoritePicker\//)
 assert.match(view,/href="\/compare"/)
 const picker=read('../src/components/profile/FavoritePicker.tsx')
 assert.match(picker,/auth\.getUser/)
 assert.doesNotMatch(picker,/public_profile:\s*true|show_favorites:\s*true/)
})
