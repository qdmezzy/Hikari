-- SAFE TO RUN FIRST in Supabase SQL Editor. Read-only; no account data or secrets.
-- One result table so a Supabase CSV export includes every check.
-- Send back the CSV and tell us whether this is staging or production.
WITH required(table_name,column_name) AS (VALUES
 ('custom_lists','id'),('custom_lists','user_id'),('custom_lists','name'),('custom_lists','description'),('custom_lists','is_public'),('custom_lists','updated_at'),
 ('custom_list_items','id'),('custom_list_items','list_id'),('custom_list_items','media_id'),('custom_list_items','media_type'),('custom_list_items','added_at'),
 ('public_profiles','user_id'),('public_profiles','handle'),('public_profiles','display_name'),('public_profiles','public_profile'),('public_profiles','show_favorites'),('public_profiles','favorite_media_ids'),
 ('notifications','user_id'),('notifications','actor_id'),('notifications','type'),('notifications','title'),('notifications','message'),('notifications','href'),('notifications','metadata'),('notifications','dedupe_key'),
 ('social_reports','id'),('social_reports','post_id'),('social_reports','target_id'),('social_reports','target_type'),('social_reports','status'),('social_reports','reason'),('social_reports','resolved_at'),('social_reports','resolved_by'),('social_reports','resolution_action'),('social_reports','resolution_note'),
 ('social_posts','id'),('social_posts','user_id'),('social_posts','content'),('social_posts','attached_media_id'),('social_posts','attached_media_title'),('social_posts','attached_media_type'),('social_posts','has_spoilers'),('social_posts','spoiler_range'),('social_posts','post_type'),('social_posts','post_to_discover'),
 ('social_posts','is_removed'),('social_posts','removed_at'),('social_posts','removed_by'),('social_posts','removed_reason'),
 ('reviews','is_removed'),('reviews','removed_at'),('reviews','removed_by'),('reviews','removed_reason'),
 ('clip_comments','is_removed'),('clip_comments','removed_at'),('clip_comments','removed_by'),('clip_comments','removed_reason'),
 ('fandom_clips','is_removed'),('fandom_clips','removed_at'),('fandom_clips','removed_by'),('fandom_clips','removed_reason'),
 ('feedback','user_id'),('feedback','resolved'),
 ('list_entries','user_id'),('list_entries','media_id'),('list_entries','media_type'),('list_entries','progress'),('list_entries','status'),('list_entries','score'),
 ('episode_alerts','user_id'),('episode_alerts','media_id'),('episode_alerts','last_notified_episode'),
 ('push_subscriptions','user_id'),('push_subscriptions','endpoint'),('push_subscriptions','p256dh'),('push_subscriptions','auth')
), column_checks AS (
SELECT r.table_name,r.column_name,
 CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'ready' END AS status,
 c.data_type
FROM required r LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
), feature_checks AS (
SELECT name, to_regclass('public.'||name) IS NOT NULL AS already_exists
FROM unnest(ARRAY['moderation_decisions','collection_follows','collection_publications','discover_hidden_titles','watch_clubs','watch_club_episodes','watch_club_members','tracking_history','push_delivery_jobs']) name
), policy_checks AS (
-- Policy definitions only, never stored row data.
SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('custom_lists','custom_list_items','public_profiles','feedback')
)
SELECT 'required_column' AS check_type, table_name||'.'||column_name AS target,
 status, jsonb_build_object('data_type',data_type) AS details
FROM column_checks
UNION ALL
SELECT 'feature_table', name, CASE WHEN already_exists THEN 'already_exists' ELSE 'not_installed' END,
 jsonb_build_object('already_exists',already_exists)
FROM feature_checks
UNION ALL
SELECT 'required_function', 'public.is_moderator()',
 CASE WHEN to_regprocedure('public.is_moderator()') IS NULL THEN 'MISSING' ELSE 'ready' END,
 '{}'::jsonb
UNION ALL
SELECT 'policy', tablename||'.'||policyname, 'review',
 jsonb_build_object('command',cmd,'using',qual,'with_check',with_check)
FROM policy_checks
ORDER BY check_type,target;
