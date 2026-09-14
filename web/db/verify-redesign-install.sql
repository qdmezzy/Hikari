-- READ ONLY. Run after migrations 01–09. Export this single result table.
-- Inspects schema/permissions only; does not read user records or call feature functions.
-- 'ready' confirms installation checks, not end-to-end application behavior.
WITH tables(name) AS (VALUES
 ('moderation_decisions'),('collection_follows'),('collection_publications'),
 ('discover_hidden_titles'),('watch_clubs'),('watch_club_episodes'),
 ('watch_club_members'),('tracking_history'),('push_delivery_jobs')
), routines(signature,client_execute,definer) AS (VALUES
 ('public.decide_social_report(uuid,text,text,timestamptz,text)',true,true),
 ('public.duplicate_own_collection(uuid)',true,true),
 ('public.reorder_own_collection(uuid,uuid[],uuid[])',true,true),
 ('public.follow_collection(uuid)',true,true),
 ('public.publish_collection_update(uuid,text)',true,true),
 ('public.compare_public_favorites(text)',true,true),
 ('public.open_watch_club(text,bigint)',true,true),
 ('public.open_club_episode(uuid,integer)',true,true),
 ('public.close_watch_club(uuid)',true,true),
 ('public.record_tracking_history()',false,true),
 ('public.enqueue_episode_push(integer,integer,text,timestamptz)',false,false),
 ('public.claim_episode_push()',false,false),
 ('public.finish_episode_push(uuid,uuid,text,text)',false,false)
), columns(table_name,column_name,data_type) AS (VALUES
 ('custom_lists','cover_media_id','integer'),
 ('custom_list_items','position','integer'),
 ('public_profiles','allow_taste_comparison','boolean')
), checks AS (
 SELECT 'table_rls' AS check_type,t.name AS target,
   CASE WHEN c.oid IS NULL THEN 'MISSING' WHEN c.relrowsecurity THEN 'ready' ELSE 'CHECK FAILED' END AS status,
   jsonb_build_object('row_security',c.relrowsecurity) AS details
 FROM tables t LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||t.name)
 UNION ALL
 SELECT 'function_permissions',r.signature,
   CASE WHEN p.oid IS NULL THEN 'MISSING'
     WHEN NOT has_function_privilege('anon',p.oid,'EXECUTE')
       AND has_function_privilege('authenticated',p.oid,'EXECUTE')=r.client_execute
       AND p.prosecdef=r.definer
       AND (r.client_execute OR r.signature='public.record_tracking_history()' OR has_function_privilege('service_role',p.oid,'EXECUTE'))
     THEN 'ready' ELSE 'CHECK FAILED' END,
   jsonb_build_object('anonymous_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
     'signed_in_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
     'security_definer',p.prosecdef,'settings',p.proconfig)
 FROM routines r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature)
 UNION ALL
 SELECT 'column',r.table_name||'.'||r.column_name,
   CASE WHEN c.column_name IS NULL THEN 'MISSING' WHEN c.data_type=r.data_type THEN 'ready' ELSE 'CHECK FAILED' END,
   jsonb_build_object('type',c.data_type,'default',c.column_default)
 FROM columns r LEFT JOIN information_schema.columns c
   ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
 UNION ALL
 SELECT 'trigger','list_entries.record_tracking_history',
   CASE WHEN EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.list_entries')
     AND tgname='record_tracking_history' AND tgenabled IN ('O','A') AND NOT tgisinternal
     AND tgfoid=to_regprocedure('public.record_tracking_history()') AND tgtype=29)
   THEN 'ready' ELSE 'CHECK FAILED' END,
   jsonb_build_object('expected','Enabled AFTER INSERT/UPDATE/DELETE row trigger')
 UNION ALL
 SELECT 'private_table_access',t.name,
   CASE WHEN to_regclass('public.'||t.name) IS NULL THEN 'MISSING'
     WHEN NOT has_table_privilege('anon','public.'||t.name,'SELECT,INSERT,UPDATE,DELETE')
       AND NOT has_table_privilege('authenticated','public.'||t.name,'INSERT,UPDATE,DELETE')
       AND (t.name<>'push_delivery_jobs' OR NOT has_table_privilege('authenticated','public.'||t.name,'SELECT'))
     THEN 'ready' ELSE 'CHECK FAILED' END,
   jsonb_build_object('expected','No client writes; no anonymous access; push queue has no client reads')
 FROM (VALUES ('moderation_decisions'),('tracking_history'),('push_delivery_jobs')) t(name)
 UNION ALL
 SELECT 'policy_review',tablename||'.'||policyname,'review',
   jsonb_build_object('command',cmd,'roles',roles,'using',qual,'with_check',with_check)
 FROM pg_policies WHERE schemaname='public'
   AND (tablename IN (SELECT name FROM tables) OR tablename='feedback')
)
SELECT * FROM checks ORDER BY check_type,target;
