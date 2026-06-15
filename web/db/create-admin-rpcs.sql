-- Admin/moderator RPCs for the Mod Dashboard.
-- Depends on public.is_moderator() (see create-community-content.sql).
--
-- These are SECURITY DEFINER so a moderator can read the auth.users directory
-- and toggle another user's mod flag. Every function re-checks is_moderator()
-- using the CALLER's JWT, so regular users cannot use them even if invoked.

-- List every user with profile info + role (moderators only).
-- Dropped first because the return signature changed (added is_banned).
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    display_name TEXT,
    handle TEXT,
    avatar_url TEXT,
    is_mod BOOLEAN,
    is_banned BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_moderator() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT
        u.id,
        u.email::TEXT,
        COALESCE(
            p.display_name,
            u.raw_user_meta_data ->> 'display_name',
            u.raw_user_meta_data ->> 'full_name'
        ) AS display_name,
        COALESCE(
            p.handle,
            u.raw_user_meta_data ->> 'username',
            u.raw_user_meta_data ->> 'handle'
        ) AS handle,
        COALESCE(p.avatar_url, u.raw_user_meta_data ->> 'avatar_url') AS avatar_url,
        COALESCE(
            (u.raw_app_meta_data ->> 'is_mod')::BOOLEAN,
            (u.raw_app_meta_data ->> 'isMod')::BOOLEAN,
            FALSE
        ) AS is_mod,
        COALESCE((u.raw_app_meta_data ->> 'is_banned')::BOOLEAN, FALSE) AS is_banned,
        u.created_at
    FROM auth.users u
    LEFT JOIN public.public_profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

-- Grant / revoke a user's moderator role (moderators only).
CREATE OR REPLACE FUNCTION public.admin_set_user_mod(target_user_id UUID, make_mod BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_moderator() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Write to app_metadata (service-role only) so the user can't undo/forge it.
    UPDATE auth.users
    SET raw_app_meta_data =
        jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{is_mod}', to_jsonb(make_mod))
    WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_mod(UUID, BOOLEAN) TO authenticated;
