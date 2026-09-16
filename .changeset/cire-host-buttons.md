---
"@cire/ui": minor
"@cire/host": patch
---

`cire/host`'s raw buttons become `@cire/ui`'s, and `Button` grows the four shapes it was missing

72 of the 98 raw `<button>` elements in `cire/host` are now `<Button>`. The
remaining 26 are reported by the codemod rather than silently skipped: 13 build
their class list dynamically, and the rest are one-offs.

**Four new variants, all borderless**, because half of what host was writing by
hand had no home in `primary`/`cta`/`outline`/`quiet`/`danger`:

- `link` — the affirmative text action. Accent ink, underlines on hover.
- `subtle` — its opposite number, "Cancel" and "Dismiss". Muted ink that
  brightens, and it keeps the underline.
- `bare` — a glyph: a move-up arrow, a close cross. No underline, because there
  is no word to underline.
- `bareDanger` — a glyph that destroys something. Muted at rest, because a row
  of red crosses down a table reads as an error state rather than a column of
  controls, and danger on hover, where the warning arrives when it is useful.

They take the type size from a parallel size map and none of a bordered
control's padding, and they are not uppercase: a link reads as a sentence
fragment, and shouting it makes it a button wearing a link's clothes.
