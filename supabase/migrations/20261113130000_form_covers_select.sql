-- Storage deletes (and upserts) look the object up first, which needs a
-- SELECT policy. Scope it to editors of the cover's form, so the public
-- bucket still can't be listed by anyone else (public URLs serve reads).
CREATE POLICY "Editors read their form covers" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'form-covers' AND private.can_edit_cover(name));
