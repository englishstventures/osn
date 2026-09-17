---
title: Design tokens — the contract every shared component reads
tags:
  - architecture
  - design-system
  - tokens
related:
  - "[[component-library]]"
  - "[[frontend-patterns]]"
  - "[[browser-tests]]"
  - "[[toast]]"
  - "[[osn-and-musubi]]"
last-reviewed: 2026-09-17
---

# Design tokens — `@shared/design-tokens` and the `osn-*` contract

One neutral vocabulary that every shared package writes and every app maps onto
once. Colour roles, plus type, tracking, leading, radius and measure scales.

## The problem it solves

Two token vocabularies were in use across ten frontends: shadcn's semantic names
(`--card`, `--primary`, `--muted-foreground`) in `@musubi/social` and
`@pulse/web`, and cire's house ramp (`--gold`, `--bg`, `--text-muted`) in every
`@cire/*` app. A component cannot be shared across that split, because it has to
name a colour to paint one.

Without a shared vocabulary there are only three ways out, and a codebase that
lacks one ends up using all of them: write the component in plain CSS keyed off
its own custom properties, beat the library's defaults with `!important` at
every call site, or keep a duplicate component per app. The contract exists so
that none of the three is ever the answer.

## The shape

```
  app vocabulary          contract              component
  ──────────────          ────────              ─────────
  --card         ──map──▶ --osn-surface  ──────▶ bg-osn-surface
  --gold         ──map──▶ --osn-accent   ──────▶ bg-osn-accent
```

Three rules, and they are the whole design:

1. **The contract is library-facing.** `@osn/ui`, `@cire/ui`, `@shared/toast`
   and `@shared/sortable` write `osn-*` utilities. Application code never does —
   every `bg-card` in pulse and `text-gold` in cire stays exactly as written.
2. **An app maps once.** A `:root` block naming each `--osn-*` in the app's own
   vocabulary. That is the entire integration; the package carries its own
   `@source` and `@custom-variant`, so no app declares them.
3. **The namespace is what makes it real.** Nothing an app writes can collide
   with a contract utility, and nothing a contract utility reads depends on an
   app's naming.

Adopting it is two lines:

```css
@import "tailwindcss";
@import "@shared/design-tokens/tokens.css";

:root {
  --osn-surface: var(--card);
  --osn-ink: var(--foreground);
  --osn-accent: var(--primary);
  /* … */
}
```

## The tokens

| Group    | Names                                                               |
| -------- | ------------------------------------------------------------------- |
| Grounds  | `ground`, `ground-deep`                                             |
| Surfaces | `surface`, `surface-raised`, `surface-sunk`                         |
| Lines    | `hairline`, `hairline-strong`                                       |
| Ink      | `ink`, `ink-secondary`, `ink-tertiary`                              |
| Accent   | `accent`, `accent-strong`, `accent-soft`, `accent-ink`, `on-accent` |
| Status   | `success`, `warn`, `danger`, `on-danger`                            |
| Focus    | `focus`                                                             |

Scales: `text-osn-xs` … `2xl`, `tracking-osn-tight` … `ultra`,
`leading-osn-none` … `relaxed`, `radius-osn-hair` … `pill` plus
`radius-osn-control`.

Two names are worth reading twice. **`ground-deep` is not "darker"** — it is
what the page recedes _to_, behind a sticky bar or under a scrim, and on a dark
theme it is lighter. **`accent-ink` is not `on-accent`**: `accent-ink` is accent
text on the page, `on-accent` is the label on a filled accent ground, and the
two have opposite contrast requirements.

## Three decisions that are easy to get wrong

### `@theme inline`, not plain `@theme`

`inline` makes `bg-osn-surface` compile to `var(--osn-surface, …)` resolved **at
the element**, not at `:root`. A subtree that redefines a token is then followed
correctly — a theme story showing light and dark side by side, a themed section
on a landing page, cire's invite preview rendering a wedding's palette inside
the organiser's own chrome. Without `inline` the alias resolves once at `:root`
and every one of those silently shows the page theme instead.

The reason `cire/host` gives for keeping _its own_ theme block non-inline does
not transfer: there the JS-read name is `--color-gold`. Here nothing reads
`--color-osn-*` from JavaScript.

### Fallbacks inline, and no `:root` in the package

Every read is `var(--osn-x, <fallback>)` written at the use site. There is
deliberately **no `:root` block in `tokens.css`**: a package-level `:root` is
unlayered and lands at the import site, so it would beat an app mapping written
inside `@layer base` or a later `@theme` — the app would set a token and
silently get the library's value.

The fallbacks are a neutral greyscale, never a brand. An unmapped app renders
**legibly rather than correctly**, which is the intended failure.

### `base:` belongs to a component, not to a caller

`@custom-variant base (:where(&))` gives a component zero-specificity defaults,
so a caller's plain utility beats them. A caller who writes `base:` too **ties**,
and a tie resolves by Tailwind's stylesheet order — not by class-attribute
order, and not by anything visible at the call site. See
[[wiki/architecture/component-library]] §Overriding a `Modal` default, which is
where that cost nine call sites.

## The conformance harness

`@shared/design-tokens` exports `contrastPairs()` and
`assertContractConformance()`. Every app calls it from its own suite: the
harness resolves the app's mapping and checks each foreground/background pair
against WCAG 2.2 — 4.5:1 for text (SC 1.4.3), 3:1 for non-text and focus
indicators (SC 1.4.11).

This is not ceremony. Deriving the first four mappings surfaced **13 pre-existing
contrast defects**, including cire's primary button at 2.42:1 with a light label
and 1.80:1 on dark hover, and pulse's focus ring at 2.38:1 — a ring nobody can
see removes the feature outright for a keyboard user.

> [!warning]
> The harness checks the **tokens**. It cannot see a component that hard-codes a
> colour, an app utility used inside a library package, or a class Tailwind
> never compiled. Those need the browser tier
> ([[wiki/conventions/browser-tests]]), and in the case of raw palette colours,
> `@shadcn/lint`'s `no-raw-colors`.

## Where the pieces live

| Package                 | What                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@shared/design-tokens` | `tokens.css` (the contract), the conformance harness, and `CONTRACT_SCALES` / `SCALE_MIGRATION` which the scale codemod reads                       |
| `@shared/color`         | The OKLCH maths — parsing, conversion, contrast, `ensureContrast`. Lifted out of `@cire/theme` so no `@shared/*` package depends on a `@cire/*` one |
| `@osn/ui`               | The shadcn-vocabulary primitives, re-keyed onto the contract                                                                                        |
| `@cire/ui`              | cire's house components — see [[wiki/architecture/component-library]] for why two layers rather than one                                            |

`scripts/codemod-scale.ts` is the migration tool: it rewrites static arbitrary
values (`text-[13px]`) onto the nearest scale step and **skips computed ones**
(`var`, `calc`, `clamp`, `min`, `max`, gradients), printing every skip by name.
It ran once across all six apps, moving 1,021 values.

_Measured 2026-09-16 — `bun run scripts/codemod-scale.ts`, whose own report
prints the counts._
