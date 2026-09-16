---
"@tools/pr-metrics": minor
---

`card --if-absent` writes a card only where the branch has none, and exits before reading a single transcript where one already exists.

The `SessionEnd` hook in `.claude/settings.json` runs the collector unattended as a session closes, with no `--pr`, `--issue` or `--issue-labels` — it has no way to know them. Unguarded it therefore overwrote the identity-bearing card with one whose pull request, issue and `complexity.declared` were all null, into a working tree nobody is watching, and the result then sat in the corpus looking complete while answering none of the questions the cards exist for. The hook now passes the flag; the new `retro` skill owns the identity-bearing write and still overwrites unconditionally.
