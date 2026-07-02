-- Avatar storage bucket + policies
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "Users can upload avatars" on storage.objects;
create policy "Users can upload avatars"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists "Users can update avatars" on storage.objects;
create policy "Users can update avatars"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars' and auth.uid() = owner)
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists "Users can delete avatars" on storage.objects;
create policy "Users can delete avatars"
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars' and auth.uid() = owner);
