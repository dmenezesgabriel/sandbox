Implemented the Ask Data clarification accessibility grouping update for issue `15-group-ask-clarification-choices-with-role-group`.

Changed files:

- `src/components/ask-clarification/ask-clarification.ts`
- `src/styles/ask.css`

What changed:

- Wrapped the clarification choice buttons in a `<div class="clarification-choices" role="group" aria-labelledby="clarification-message">`.
- Added `id="clarification-message"` to the clarification message `<p>` so the group is labelled by the prompt text.
- Added `.clarification-choices` styles in `ask.css` with flex layout, wrapping, gap spacing, and top margin.
- Preserved existing choice-selection behavior: each `ui-button` still calls `_choose(choice)`, which still dispatches the same `choice-select` event.

Validation:

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run build` ✅
  - Build completed successfully; existing Vite chunk-size warning remains.

Notes:

- There were no visible separator dots in the current template, so no separator-removal logic was needed.
- The change is limited to semantics and layout; no selection logic was altered.
