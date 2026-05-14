Implemented the formatting-only fix for the files failing `npm run format:check`.

Changed files:

- `issues/01-frontend-target-structure.md`
- `issues/01-worker-output.md`
- `issues/02-app-shell-and-routing.md`
- `issues/03-dashboard-feature-boundary.md`
- `issues/04-question-feature-boundary.md`
- `issues/05-ask-feature-boundary.md`
- `issues/06-infra-and-runtime-boundary.md`
- `issues/07-shared-types-and-utils.md`
- `issues/08-import-cleanup-and-docs.md`
- `issues/reviewer-validation-report.md`
- `references/frontend-target-structure.md`

Validation:

- Ran `npm run format:check`
- Result: `All matched files use Prettier code style!`

Open risks/questions:

- The formatted files in `issues/` and `references/` are currently untracked in git in this working tree; no application code was changed.

Recommended next step:

- Review and commit the formatted markdown/reference files along with this report.

Current date: 2026-05-14
Current working directory: /home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask
