---
"@osn/ui": minor
"@cire/host": patch
"@cire/invites": patch
---

Table cells get `align`, `tone` and `valign`; `cire/invites` converts 11 more raw buttons

21 class overrides on `Th` and `Td` across `cire/host` become props. Each was
fighting the component on the same CSS property, which two Tailwind utilities
resolve by stylesheet order rather than by their order in `class` — so
`<Td class="text-right">` against the component's own `text-left` was a coin
flip, not an override.

`Th` and `Td` now `Omit` the native `align` attribute rather than intersecting
it. `<td align>` is a deprecated native attribute typed
`"left" | "center" | "right"`, and intersecting narrows the prop to the one
value both unions share — so `align="end"` became a type error with a baffling
message. The same collision `Input`'s `size` has, and the type checker is what
found it.

`Table` sets `font-osn-body` itself, which three call sites were adding.

11 more raw buttons in `cire/invites` are `<Button>`. The codemod now refuses to
touch a `<button>` carrying a "Deliberately not `@cire/ui`'s `Button`" comment —
it had already converted the RSVP modal's submit back, undoing a documented
decision about `aria-disabled` on a confirmed state.
