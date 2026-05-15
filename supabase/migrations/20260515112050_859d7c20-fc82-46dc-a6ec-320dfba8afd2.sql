CREATE POLICY "Users can update their own forms"
ON public.forms FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forms"
ON public.forms FOR DELETE
TO authenticated
USING (auth.uid() = user_id);