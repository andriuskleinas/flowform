## Spacing Adjustments — Three Polish Edits

### 1. Input field internal padding → 16px
Update the base `Input` and `Textarea` UI components so all form fields receive consistent 16px horizontal and vertical padding.

- `src/components/ui/input.tsx`: change `px-3 py-1` → `px-4 py-4`
- `src/components/ui/textarea.tsx`: change `px-3 py-2` → `px-4 py-4`

### 2. Card padding → 16px
The app uses custom card-like sections (not the shadcn Card primitive). Standardise their padding to `p-4` so every card has exactly 16px on all sides.

- `src/routes/dashboard.tsx`: form list items (`p-5 md:p-6` → `p-4`)
- `src/routes/forms.new.tsx`: main sections (`p-6 md:p-8` → `p-4 md:p-4`) and question items (`p-4 md:p-5` → `p-4 md:p-4`)
- `src/routes/forms.$formId.edit.tsx`: header card (`p-6 md:p-8` → `p-4 md:p-4`) and question cards (`p-4 md:p-5` → `p-4 md:p-4`)

### 3. Section spacing → 24px; title/description gap → 12px
- **Dashboard**: reduce `mt-10` between the page header and the forms list to `mt-6` (24px).
- **New form page**: reduce `space-y-5` inside "Form details" to `space-y-3` (12px) between title and description fields.
- **Edit form page**: reduce `space-y-4` inside the header card to `space-y-3` (12px) between title and description inputs.

No functionality changes — only padding and margin values.