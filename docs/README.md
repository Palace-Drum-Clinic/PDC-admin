# PDC Docs

This folder is the canonical home for Palace Drum Clinic product docs.

## Structure

- `docs/roadmap.md` — high-level roadmap and themes
- `docs/features/` — feature specs (one file per feature)
- `docs/ux/` — UX notes and UI requirements (linked from feature specs)
- `docs/decisions/` — ADRs (architecture decisions)

## Workflow (Slack → shipped)

1. **Product** drafts/updates roadmap + feature spec in `docs/features/`.
2. **UX** adds UX requirements in `docs/ux/` (and links them from the feature spec).
3. **Tech Lead** adds security/architecture notes + acceptance criteria.
4. **Dev** implements + opens PR.
5. **QA** verifies with a checklist.
6. **Human** (Josh) reviews + merges.
