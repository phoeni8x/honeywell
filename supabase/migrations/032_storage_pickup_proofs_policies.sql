-- Support/pickup attachments use this bucket from anonymous customer sessions.
-- Public read is needed for inline image rendering in customer/admin chats.
-- Public insert is needed because customers are not Supabase-authenticated users.

do $$
begin
  create policy "pickup_proofs_public_read"
    on storage.objects
    for select
    to public
    using (bucket_id = 'pickup-proofs');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "pickup_proofs_public_insert"
    on storage.objects
    for insert
    to public
    with check (bucket_id = 'pickup-proofs');
exception
  when duplicate_object then null;
end $$;
