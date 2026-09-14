// Isolated PostgreSQL smoke checks using a synthetic prerequisite schema.
// No network, environment secrets, or production database access.
// Usage: node scripts/check-redesign-db.mjs <temporary folder containing @electric-sql/pglite>
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(resolve(process.argv[2], 'package.json'))
const { PGlite } = require('@electric-sql/pglite')
const db = new PGlite()
const owner = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const asUser = async (id, mod = false) => {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.mod',$2,false)", [id, String(mod)])
  await db.exec('SET ROLE authenticated')
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_moderator() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.mod',true),'false')::boolean $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    CREATE TABLE custom_lists(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,name text,description text,is_public boolean DEFAULT false,updated_at timestamptz DEFAULT now());
    CREATE TABLE custom_list_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),list_id uuid REFERENCES custom_lists(id) ON DELETE CASCADE,media_id bigint,media_type text,added_at timestamptz DEFAULT now(),UNIQUE(list_id,media_id));
    ALTER TABLE custom_lists ENABLE ROW LEVEL SECURITY;
    CREATE POLICY read_lists ON custom_lists FOR SELECT USING(is_public OR user_id=auth.uid());
    CREATE POLICY own_lists ON custom_lists FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE TABLE public_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,handle text,display_name text,public_profile boolean,show_favorites boolean,favorite_media_ids bigint[]);
    CREATE TABLE feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,resolved boolean);
    ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can submit feedback" ON feedback FOR INSERT WITH CHECK(true);
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,actor_id uuid,type text,title text,message text,href text,metadata jsonb,dedupe_key text);
    CREATE TABLE social_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,content text,attached_media_id bigint,attached_media_title text,attached_media_type text,has_spoilers boolean,spoiler_range text,post_type text,post_to_discover boolean,is_removed boolean DEFAULT false,removed_at timestamptz,removed_by uuid,removed_reason text);
    CREATE TABLE social_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid,target_id text,target_type text,status text DEFAULT 'pending',reason text,resolved_at timestamptz,resolved_by uuid,resolution_action text,resolution_note text);
    CREATE TABLE reviews(id uuid PRIMARY KEY,is_removed boolean,removed_at timestamptz,removed_by uuid,removed_reason text);
    CREATE TABLE clip_comments(LIKE reviews INCLUDING ALL); CREATE TABLE fandom_clips(LIKE reviews INCLUDING ALL);
    CREATE TABLE list_entries(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,media_id bigint,media_type text,progress integer,status text,score integer,PRIMARY KEY(user_id,media_id));
    CREATE TABLE episode_alerts(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,media_id integer,last_notified_episode integer DEFAULT 0,PRIMARY KEY(user_id,media_id));
    CREATE TABLE push_subscriptions(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,endpoint text UNIQUE,p256dh text,auth text);
  `)
  for (const name of readdirSync(new URL('../db/migrations/', import.meta.url)).filter(name => /^20260906_\d\d_/.test(name)).sort()) {
    await db.exec(readFileSync(new URL(`../db/migrations/${name}`, import.meta.url), 'utf8'))
    console.log(`Applied to synthetic database: ${name}`)
  }
  await db.query('INSERT INTO auth.users VALUES ($1),($2)', [owner, member])
  await asUser(owner)
  const collection = await scalar("INSERT INTO custom_lists(user_id,name,is_public) VALUES(auth.uid(),'Test collection',true) RETURNING id")
  await db.query("INSERT INTO custom_list_items(list_id,media_id,media_type) VALUES($1,1,'ANIME'),($1,2,'ANIME')", [collection])
  const itemIds = (await db.query('SELECT id FROM custom_list_items WHERE list_id=$1 ORDER BY added_at DESC,id', [collection])).rows.map(r => r.id)
  await db.query('SELECT reorder_own_collection($1,$2::uuid[],$3::uuid[])', [collection, [...itemIds].reverse(), itemIds])
  await assert.rejects(db.query('SELECT reorder_own_collection($1,$2::uuid[],$3::uuid[])', [collection, itemIds, itemIds]), /changed/)
  const copied = await scalar('SELECT duplicate_own_collection($1)', [collection])
  assert.equal(await scalar('SELECT is_public FROM custom_lists WHERE id=$1', [copied]), false)
  assert.equal(await scalar('SELECT count(*)::int FROM custom_list_items WHERE list_id=$1', [copied]), 2)
  await asUser(member)
  await assert.rejects(db.query('SELECT duplicate_own_collection($1)', [collection]), /unavailable/)
  await db.query('SELECT follow_collection($1)', [collection])
  await asUser(owner)
  await db.query("SELECT publish_collection_update($1,'A new pick')", [collection])
  await assert.rejects(db.query("SELECT publish_collection_update($1,'Again')", [collection]), /wait an hour/)
  assert.equal(await scalar('SELECT count(*)::int FROM notifications WHERE user_id=$1', [member]), 1)
  console.log('PASS: collection ownership, stale ordering, private duplication and publication throttling')

  await db.query('INSERT INTO feedback(user_id,resolved) VALUES($1,false)', [owner])
  await assert.rejects(db.query('INSERT INTO feedback(user_id) VALUES($1)', [member]), /row-level security/)
  await db.query("INSERT INTO public_profiles VALUES($1,'owner','Owner',true,true,ARRAY[1,2]::bigint[],true),($2,'member','Member',true,true,ARRAY[2,3]::bigint[],true)", [owner, member])
  const comparison = await scalar("SELECT compare_public_favorites('member')")
  assert.deepEqual(comparison.shared_ids, [2])
  assert.equal(comparison.union_count, 3)
  await db.query('UPDATE public_profiles SET allow_taste_comparison=false WHERE user_id=$1', [member])
  await assert.rejects(db.query("SELECT compare_public_favorites('member')"), /unavailable/)
  await db.exec("INSERT INTO discover_hidden_titles(user_id,media_id,title) VALUES(auth.uid(),1,'Test hidden title')")
  await asUser(member)
  assert.equal(await scalar('SELECT count(*)::int FROM feedback'), 0)
  assert.equal(await scalar('SELECT count(*)::int FROM discover_hidden_titles'), 0)
  console.log('PASS: own-feedback privacy, sender identity, comparison opt-out and hidden-title isolation')

  await assert.rejects(db.query("SELECT open_watch_club('Test club',1)"), /Moderator/)
  await asUser(owner, true)
  const club = await scalar("SELECT open_watch_club('Test club',1)")
  const post = await scalar('SELECT open_club_episode($1,1)', [club])
  assert.equal(await scalar('SELECT open_club_episode($1,1)', [club]), post)
  const report = await scalar("INSERT INTO social_reports(post_id,target_type,reason) VALUES($1,'social_post','Test') RETURNING id", [post])
  await db.query("SELECT decide_social_report($1,'remove','pending',null,'Test decision')", [report])
  assert.equal(await scalar('SELECT is_removed FROM social_posts WHERE id=$1', [post]), true)
  await assert.rejects(db.query("SELECT decide_social_report($1,'dismiss','pending',null,'Stale')", [report]), /changed/)
  const missing = await scalar("INSERT INTO social_reports(target_id,target_type) VALUES('missing','social_post') RETURNING id")
  await assert.rejects(db.query("SELECT decide_social_report($1,'remove','pending',null,'Test')", [missing]), /no longer exists/)
  assert.equal(await scalar('SELECT status FROM social_reports WHERE id=$1', [missing]), 'pending')
  await asUser(member)
  await assert.rejects(db.query("SELECT decide_social_report($1,'dismiss','pending',null,'No')", [missing]), /Moderator/)
  console.log('PASS: moderator permission, idempotent club episodes, atomic removal, stale decisions and rollback')

  await asUser(owner)
  await db.exec("INSERT INTO list_entries VALUES(auth.uid(),1,'ANIME',10,'watching',0); UPDATE list_entries SET progress=11 WHERE media_id=1;")
  assert.equal(await scalar('SELECT count(*)::int FROM tracking_history'), 2)
  await asUser(member)
  assert.equal(await scalar('SELECT count(*)::int FROM tracking_history'), 0)
  await assert.rejects(db.exec("INSERT INTO tracking_history(user_id,media_id,media_type,action) VALUES(auth.uid(),1,'ANIME','added')"), /permission/)
  await db.exec('RESET ROLE')
  await db.query('DELETE FROM auth.users WHERE id=$1', [owner])
  assert.equal(await scalar('SELECT count(*)::int FROM tracking_history'), 0)
  console.log('PASS: tracking history privacy, no client-forged history and account-deletion cascade')

  await db.query("INSERT INTO episode_alerts(user_id,media_id) VALUES($1,1);", [member])
  await db.query("INSERT INTO push_subscriptions VALUES($1,'https://example.invalid/device-a','test','test'),($1,'https://example.invalid/device-b','test','test')", [member])
  await db.exec('SET ROLE service_role')
  assert.equal(await scalar("SELECT enqueue_episode_push(1,2,'Test',now())"), 2)
  assert.equal(await scalar("SELECT enqueue_episode_push(1,2,'Test',now())"), 0)
  const first = (await db.query('SELECT * FROM claim_episode_push()')).rows[0]
  const second = (await db.query('SELECT * FROM claim_episode_push()')).rows[0]
  assert.notEqual(first.id, second.id)
  assert.equal((await db.query('SELECT * FROM claim_episode_push()')).rows.length, 0)
  assert.equal(await scalar("SELECT finish_episode_push($1,$2,'sent',null)", [first.id, first.lease_token]), true)
  assert.equal(await scalar("SELECT finish_episode_push($1,$2,'pending','late')", [first.id, first.lease_token]), false)
  assert.equal(await scalar("SELECT finish_episode_push($1,$2,'pending','http_503')", [second.id, second.lease_token]), true)
  assert.equal((await db.query('SELECT * FROM claim_episode_push()')).rows.length, 0)
  await db.query("UPDATE push_delivery_jobs SET next_attempt_at=now()-interval '1 minute' WHERE id=$1", [second.id])
  const retry = (await db.query('SELECT * FROM claim_episode_push()')).rows[0]
  assert.equal(retry.id, second.id)
  assert.equal(retry.attempts, 2)
  assert.equal(await scalar("SELECT finish_episode_push($1,$2,'sent',null)", [retry.id, second.lease_token]), false)
  await db.query("UPDATE push_delivery_jobs SET lease_until=now()-interval '1 minute' WHERE id=$1", [retry.id])
  const recovered = (await db.query('SELECT * FROM claim_episode_push()')).rows[0]
  assert.equal(recovered.id, retry.id)
  assert.notEqual(recovered.lease_token, retry.lease_token)
  assert.equal(await scalar("SELECT finish_episode_push($1,$2,'sent',null)", [recovered.id, recovered.lease_token]), true)
  await asUser(member)
  await assert.rejects(db.exec('SELECT * FROM push_delivery_jobs'), /permission/)
  await assert.rejects(db.exec('SELECT * FROM claim_episode_push()'), /permission/)
  console.log('PASS: per-device deduplication, claims, stale receipts, retry delay and client denial')
  console.log('Synthetic PostgreSQL checks passed. This does not verify production constraints, concurrent sessions, or real deliveries.')
  await db.exec('RESET ROLE')
  const installation = await db.query(readFileSync(new URL('../db/verify-redesign-install.sql', import.meta.url), 'utf8'))
  assert.deepEqual(installation.rows.filter(row => !['ready','review'].includes(row.status)), [])
  console.log('PASS: read-only installation verification query')
} catch (error) {
  console.error('Database check failed:', error.message, error.detail || '')
  process.exitCode = 1
} finally { await db.close() }
