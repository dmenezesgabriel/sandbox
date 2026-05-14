Implemented issue 02 app shell and routing extraction.
Changed files: `src/app/main.ts`, `src/app/shell/app-shell.ts`, `src/app/routing/hash-routes.ts`, `src/main.ts`, `src/components/dashboard/dashboard.ts`, `index.html`.
Validation: `npm run build` ✅; `npm run test:components -- src/components/dashboard/dashboard.spec.ts` ✅; `npm run test:storybook -- src/components/dashboard/dashboard.stories.ts` completed with the story file discovered but no generated tests to run (skipped); checked `src/app`/dashboard paths for runtime `@` imports ✅.
Open risks/questions: manual browser verification for `#/`, `#/dashboard/portable-bi-dashboard`, `#/questions`, and `#/question/sales-by-region` was not run here, so back/forward and direct hash edit behavior is only covered by preserved routing logic plus build/spec validation.
Recommended next step: manually smoke-test the four hash routes in the browser and confirm history navigation still re-renders correctly.
Current date: 2026-05-14
Current working directory: /home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask
