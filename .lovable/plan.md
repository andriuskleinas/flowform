## Goal
Make the Preview modal fully interactive — typing in text fields, ticking checkboxes, and clicking stars should work — without actually submitting any response to the database.

## Changes (single file: `src/routes/forms.$formId.edit.tsx`)

1. **Add local preview-answers state** alongside the existing `previewOpen` state:
   ```
   const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
   ```

2. **Reset answers when the dialog opens** so reopening starts fresh — wire into the existing `onOpenChange`:
   ```
   onOpenChange={(open) => {
     setPreviewOpen(open);
     if (open) setPreviewAnswers({});
   }}
   ```

3. **Drop `disabled` and wire `value` / `onChange`** on each `<QuestionRender>` inside the dialog:
   ```
   <QuestionRender
     question={q}
     value={previewAnswers[q.id]}
     onChange={(v) => setPreviewAnswers((a) => ({ ...a, [q.id]: v }))}
   />
   ```

4. **Submit button stays disabled** in the preview (no DB write). Add a small note like "Responses aren't recorded in preview" near the submit button so it's clear why nothing happens on submit.

## Out of scope
- No DB or schema changes
- No change to `QuestionRender` itself — it already supports interactive mode (used on the public form page the same way)
- No change to the public form rendering / actual submission flow