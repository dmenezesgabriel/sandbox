# Issue 01: Frontend target structure and refactor guardrails

## Objective

Define and lock the target frontend folder structure, migration rules, and backlog conventions before any file moves start.

## Why

The current frontend mixes two patterns:

- UI custom elements live under `src/components/*`.
- Most domain, orchestration, parsing, registry, and infra files live flat at `src/*.ts`.

That makes ownership unclear, import churn risky, and future moves harder to stage safely.

## Current-state findings

- `src/main.ts` imports global CSS and the route shell from `src/components/dashboard`.
- `src/components/dashboard/dashboard.ts` currently acts as the app shell and hash router.
- Dashboard and question logic is split between UI folders and flat top-level files such as `src/dashboard-registry.ts`, `src/question-registry.ts`, `src/dashboard-yaml.ts`, `src/question-yaml.ts`.
- Ask/orchestration logic is also flat at the top level (`src/ask-data.ts`, `src/ask-orchestrator.ts`, `src/create-dashboard-orchestrator.ts`, planner/analyzer helpers).
- Infra concerns are mixed into the same level (`src/db.ts`, `src/data-source-manager.ts`, `src/query-port.ts`, `src/shims/**`).
- Storybook stories and Vitest specs are colocated under `src/**`, and tooling depends on that.
- Vite does not define an `@` alias; Vitest does.

## Target-state snippet

```text
src/
  app/
    main.ts
    shell/
      app-shell.ts
    routing/
      hash-routes.ts
  features/
    dashboard/
      ui/
      model/
      data/
      index.ts
    question/
      ui/
      model/
      data/
      index.ts
    ask/
      ui/
      model/
      orchestration/
      index.ts
  infra/
    db/
    data-sources/
    query/
    shims/
  shared/
    types/
    ui/
    utils/
    styles/
```

## Dependencies

None.

## Scope

- Lock folder naming for `app`, `features`, `infra`, and `shared`.
- Lock shallow-structure rules.
- Lock issue naming and backlog order.
- Define migration guardrails for barrels, specs/stories, and import validation.
- Publish a repo-level reference document later issues can follow without re-deciding structure.

## Non-goals

- Moving production files.
- Changing runtime behavior.
- Splitting `src/types.ts` yet.
- Introducing new path aliases.

## Step-by-step tasks

1. Confirm the bounded-context top-level folders: `app`, `features`, `infra`, `shared`.
2. Document that feature folders should stay shallow; avoid `feature/domain/services/parsers/...` style nesting unless a later issue proves it necessary.
3. Define default internal feature shape as a small set like `ui`, `model`, `data`, or `orchestration` only when needed.
4. Define barrel guidance:
   - allow `index.ts` at feature roots and component roots,
   - allow temporary re-export files during migration,
   - remove transitional barrels only in the final cleanup issue.
5. Define test/story colocation rule: stories/specs stay under `src/**` beside the code they exercise.
6. Define import rules:
   - preserve working relative imports during moves,
   - do not assume `@` works in runtime code,
   - validate Storybook/Vite/Vitest config when paths change.
7. Define issue filename convention for this backlog: `NN-short-slug.md`.
8. Record repo-wide validation expectations each later issue must include.

## Acceptance criteria

- The target structure is documented and specific enough to guide all later issues.
- The issue explicitly names `app`, `features`, `infra`, and `shared`.
- The issue explicitly requires shallow folders and colocated stories/specs.
- The issue explicitly warns against runtime use of an unsupported alias.
- The issue establishes the `NN-short-slug.md` issue naming convention.
- A repo artifact exists that records validated tooling constraints, migration rules, and per-issue validation expectations.

## Validation

- Review `vite.config.ts`, `vitest.config.ts`, and `.storybook/main.ts` to confirm path/alias constraints are reflected.
- Review `src/main.ts` and `src/components/dashboard/dashboard.ts` to confirm current app-shell ownership is represented.
- Grep for top-level `src/*.ts` domain files to ensure the issue covers the actual flat-layout pain point.

## Deliverable

- Create and maintain `references/frontend-target-structure.md` as the canonical structure/guardrail reference for Issues 02-08.
- Keep `issues/index.md` aligned with these locked rules if backlog ordering or summary guidance changes.

## Notes / risks

- Over-designing the target structure now will create unnecessary churn later; keep it minimal.
- Splitting shared types too early can cause circular imports and broad edits.
- If later implementation needs a deeper structure than this issue allows, that should be an explicit follow-up decision, not an accidental drift.
