---
title: Component Library (Zaidan)
aliases:
  - zaidan
  - shadcn
  - UI components
  - design system
tags:
  - architecture
  - frontend
  - solidjs
  - tailwind
  - design-system
status: current
related:
  - "[[frontend-patterns]]"
  - "[[monorepo-structure]]"
  - "[[testing-patterns]]"
  - "[[pulse]]"
packages:
  - "@shared/ui"
  - "@pulse/web"
last-reviewed: 2026-09-16
---

# Component Library (Zaidan)

OSN uses **Zaidan**-style components — the SolidJS equivalent of shadcn/ui. Components are copy-pasted source files (not imported from `node_modules`) backed by **Kobalte** headless primitives and styled with **Tailwind CSS** + **CVA** (class-variance-authority).

## Why Zaidan / shadcn-style?

- **Owned source** — components live in the repo, not behind a version pin. Customise freely without forking a library.
- **Kobalte underneath** — headless primitives give proper ARIA semantics, focus trapping, portal rendering, and keyboard navigation by default.
- **CVA variants** — type-safe variant props (`variant="secondary"`, `size="sm"`) with consistent class composition.
- **Tailwind-native** — uses the same CSS variable theme the app already defines, no separate token system.

## Where Components Live

All shared UI primitives live in `@shared/ui`:

```
shared/ui/src/
├── lib/
│   └── utils.ts              ← clsx re-export, cn() (fallback)
├── components/
│   └── ui/
│       ├── avatar.tsx         ← Avatar, AvatarImage, AvatarFallback
│       ├── badge.tsx          ← Badge (variant-based)
│       ├── button.tsx         ← Button + buttonVariants (CVA)
│       ├── card.tsx           ← Card, CardHeader, CardTitle, etc.
│       ├── checkbox.tsx       ← Checkbox (Kobalte)
│       ├── dialog.tsx         ← Dialog, DialogContent, etc. (Kobalte)
│       ├── dropdown-menu.tsx  ← DropdownMenu, DropdownMenuItem, etc. (Kobalte)
│       ├── info-popover.tsx   ← InfoPopover (circled glyph beside a form label)
│       ├── input.tsx          ← Input
│       ├── label.tsx          ← Label
│       ├── otp-input.tsx      ← OtpInput (6-digit code verification)
│       ├── popover.tsx        ← Popover, PopoverTrigger, etc. (Kobalte)
│       ├── radio-group.tsx    ← RadioGroup, RadioGroupItem (Kobalte)
│       ├── tabs.tsx           ← Tabs, TabsList, TabsTrigger (Kobalte)
│       ├── textarea.tsx       ← Textarea
│       └── username-input.tsx ← UsernameInput ("@" prefix + availability status)
└── auth/
    ├── Register.tsx           ← uses Button, InfoPopover, Input, Label, OtpInput, UsernameInput
    └── SignIn.tsx           ← uses Button, Input, Label, OtpInput, clsx()
```

### `InfoPopover` — the form-field explainer

A circled glyph beside a form label, opening a `Popover` panel that says what the
field is for. `glyph` chooses the character (`?` by default, `i` where the panel
states a fact rather than answering a question), and `placement` chooses the side —
Kobalte's default `"bottom"` opens the panel over whatever sits below the trigger,
which for a field label is the input itself, so a form field usually wants `"top"`.

The trigger is a native `<button type="button">`: Kobalte's `ButtonRoot` supplies
that default, so it never submits the form it sits inside. `shared/ui`'s own tests
hold that guarantee rather than trusting it.

> [!important] Why `PopoverContent` carries `data-kb-top-layer`
> Kobalte's `Dialog` defaults to `modal: true` and sets `aria-hidden="true"` on
> everything outside itself — including nodes portalled to `<body>` after it
> opened, which it reaches with a `MutationObserver`. `PopoverContent` portals to
> `<body>`, so a popover opened from inside a dialog would be visible on screen
> and absent from the accessibility tree. `data-kb-top-layer` is what exempts a
> node from that walk; Kobalte itself sets it on `ToastRegion` and nowhere else.
>
> It sits on `PopoverContent` rather than behind a prop, because a prop is
> something every call site inside a dialog has to remember. Outside a dialog
> nothing walks the tree and the attribute does nothing.
>
> A test covering this **must flush macrotasks first**: the hide defers through
> `setTimeout` then `requestAnimationFrame`, so a check made immediately passes
> while the panel is in fact hidden. `shared/ui/tests/ui/info-popover.test.tsx`
> holds the guarantee, rendering the popover inside a real `Dialog`.

`CreateProfileForm.tsx` also uses `UsernameInput` for its handle field. `cire/host` doesn't depend on `@shared/ui` (its own component kit, different design system) — it has a local port at `cire/host/src/components/ui/UsernameInput.tsx` wrapping that kit's own `Input`, same "@"-prefix idea, used in `HostsPanel`'s add-host combobox.

Consuming apps import via subpath exports:

```typescript
import { Button } from "@shared/ui/ui/button";
import { Card } from "@shared/ui/ui/card";
import { clsx } from "@shared/ui/lib/utils";  // for conditional class joining
import { cn } from "@shared/ui/lib/utils";     // only if you need Tailwind conflict resolution
```

## Dependency Stack

| Package | Role |
|---------|------|
| `@kobalte/core` | Headless UI primitives (Dialog, Popover, Tabs, RadioGroup, Checkbox) |
| `class-variance-authority` | Type-safe variant definitions for Button, Badge |
| `clsx` | Conditional class string joining |
| `tailwind-merge` | Tailwind class conflict resolution (used only via `cn()` fallback) |

These are dependencies of `@shared/ui`. Consuming apps get them transitively — no extra installs needed.

## Class Composition: the `base:` prefix, `clsx()`, and `cn()`

Three approaches handle class composition at different levels — one source convention and two functions:

### `base:` prefix — component defaults (zero-specificity via CSS)

Component files write `base:` prefixed classes directly in source strings. These compile to `:where()` selectors with zero CSS specificity, so any consumer class automatically wins via cascade — no runtime JS needed:

```typescript
import { clsx } from "clsx";

// In a component file:
<div class={clsx("base:bg-card base:rounded-xl base:border", local.class)} />

// base:bg-card compiles to :where(.base\:bg-card) { ... } — zero specificity
// Consumer passes class="bg-card/50 rounded-md" → wins via CSS cascade
```

> **Note:** The `base:` prefix must be written literally in source strings. Tailwind v4's scanner does static analysis and cannot resolve runtime transforms.

### `clsx()` — conditional class joining (no conflict resolution)

Use for composing non-conflicting class sets, conditional classes, and signal-driven toggles:

```typescript
import { clsx } from "@shared/ui/lib/utils";

clsx("px-4 py-2", isActive && "font-bold", props.class)
```

### `cn()` — arbitrary runtime merging (with `tailwind-merge`)

Reserved for rare cases where two arbitrary class sets may contain conflicting Tailwind utilities and neither is a component default. `cn()` wraps `clsx` + `tailwind-merge` (~14 KB) for runtime conflict resolution:

```typescript
import { cn } from "@shared/ui/lib/utils";

// Only use when you genuinely have unpredictable conflicts:
cn(dynamicClassesFromSignalA(), dynamicClassesFromSignalB())
```

**Rule**: component files use `base:` prefixed strings + `clsx()`. Consumer code uses `clsx()`. Use `cn()` only when you'd otherwise get broken styles from conflicting classes.

## Performance Guidelines

### Prefer `classList` for reactive class toggles

SolidJS's `classList` directive performs fine-grained DOM updates — it adds/removes individual classes without touching the rest of the class string. When using `cn()` inside a `class` attribute binding, every signal change recomputes the entire class string and replaces the full `className`.

For static or low-cardinality elements (a few buttons, a card header), `cn()` is fine. But inside `<For>` loops or any hot path that renders many items, prefer `classList`:

```tsx
// Prefer this in <For> loops:
<button
  class="rounded-md px-3 py-1.5 text-sm font-medium"
  classList={{
    "bg-primary text-primary-foreground": isActive(),
    "bg-background text-foreground": !isActive(),
  }}
>

// Avoid this in <For> loops:
<button class={cn("rounded-md px-3 py-1.5 text-sm", isActive() ? "bg-primary" : "bg-background")}>
```

### Use `createMemo` for filtered/mapped arrays

When passing a derived array to `<For>`, wrap it in `createMemo` so the array reference is stable unless the actual contents change:

```tsx
// Good — stable reference, <For> only diffs when filter result changes
const visibleTabs = createMemo(() => tabs.filter((t) => t.show()));
<For each={visibleTabs()}>{...}</For>

// Avoid — new array on every render, <For> diffs all items every time
<For each={tabs.filter((t) => t.show())}>{...}</For>
```

### Bundle size: `tailwind-merge` and the `base:` variant

Component files write `base:` prefixed classes directly in source strings (e.g. `"base:bg-card base:rounded-xl"`) and compose with `clsx()`. The `base:` custom variant compiles to `:where()` selectors with zero specificity, so any unprefixed consumer class wins via CSS cascade — no runtime `twMerge` needed. `tailwind-merge` (~12-14 KB) is still bundled for the exported `cn()` function but is NOT called in the component render hot path.

If `tailwind-merge` is tree-shaken (i.e. no consumer imports `cn()`), the bundle drops by ~14 KB. If bundle size is a concern and `cn()` is still imported somewhere, consider refactoring the consumer to use `clsx()` instead — most conditional class composition doesn't involve Tailwind conflicts.

> **Important:** `base:` prefixes must be written directly in source strings, not generated at runtime via a function. Tailwind v4's JIT scanner does static analysis of source files — it cannot see classes produced by a runtime transform.

**Any new app** that uses `@shared/ui` components must include two things in its CSS:

1. `@source` pointing to `shared/ui/src/` (relative to the CSS file) so Tailwind scans the library's source for `base:*` class names. Without this, Tailwind v4's auto-detection ignores workspace packages in `node_modules`.
2. `@custom-variant base (:where(&));` to define the zero-specificity variant.

Example `App.css`:
```css
@import "tailwindcss";
@source "../../../shared/ui/src";
@custom-variant base (:where(&));
```

## Component Patterns

### Variant Components (Button, Badge)

Use CVA for components with discrete visual variants:

```tsx
import { Button } from "@shared/ui/ui/button";

<Button variant="default">Primary action</Button>
<Button variant="secondary" size="sm">Secondary</Button>
<Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
<Button variant="destructive">Delete</Button>
```

For links that need button styling, use the exported `buttonVariants` function:

```tsx
import { buttonVariants } from "@shared/ui/ui/button";

<A href="/settings" class={buttonVariants({ variant: "secondary", size: "sm" })}>
  Settings
</A>
```

### Kobalte Components (Dialog, Popover, Tabs, RadioGroup, Checkbox)

These wrap Kobalte primitives with styling. They provide proper accessibility by default:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@shared/ui/ui/dialog";

<Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```

Key behaviours you get by default:
- **Dialog** — portaled to `<body>`, overlay click dismisses, Escape key dismisses, focus trapped
- **Popover** — portaled, auto-positioned, outside click/Escape dismisses
- **Tabs** — `role="tablist"` / `role="tab"` / `role="tabpanel"`, keyboard arrow navigation
- **RadioGroup** — grouped `role="radiogroup"`, single selection, keyboard navigation
- **Checkbox** — `role="checkbox"`, indeterminate support

### Simple Styled Components (Input, Label, Card, Textarea)

Thin wrappers that apply consistent base styling and accept a `class` prop for overrides:

```tsx
import { Input } from "@shared/ui/ui/input";
import { Label } from "@shared/ui/ui/label";
import { Card } from "@shared/ui/ui/card";

<Card class="p-4">
  <Label for="email">Email</Label>
  <Input id="email" type="email" class="mt-1" />
</Card>
```

### Overlays: `Modal`, and why its exit is deferred

`@shared/ui`'s `Modal` is the platform's `<dialog>` with `showModal()`. The focus
trap, Escape-to-close, background inertness and `::backdrop` all come from the
browser, and the element renders in the **top layer** — above every stacking
context in the document by definition, which is what makes it immune to the
`transform`-traps-`position: fixed` bug documented in
[[wiki/architecture/frontend-patterns]]. It therefore needs **no `z-index` and
no portal**.

Its motion is split, and the split is not arbitrary:

| | How | Why there |
|---|---|---|
| **Entry** | `@starting-style`, pure CSS | The browser takes the from-state when the element is first rendered. No JavaScript at all. Safari has had it since 17.5; older engines show the dialog immediately, which degrades rather than breaks. |
| **Exit** | JavaScript defers `close()` | `close()` drops a dialog out of the top layer *immediately*, so an exit transition has nothing left to paint. |

**The CSS-only exit does not work cross-browser, and this is the thing to know
before reaching for it.** The platform's own answer is the `overlay` property
with `transition-behavior: allow-discrete`, which defers that removal so the
transition can run. `overlay` is **Chrome and Edge only** — unsupported in
Safari and Firefox. On cire's guest site, where most traffic is mobile Safari, a
CSS-only exit means the dialog blinking away for nearly everyone who sees it.

So `Modal` sets `data-closing`, lets its own stylesheet run the exit, and calls
`close()` once the element's animations have finished. It waits on
`getAnimations({ subtree: true })` rather than a named transition, so an app
animating the panel with Motion One or the Web Animations API is waited out the
same way — the hook is animation-library-agnostic without naming a library.

Timing is two custom properties, so an app retimes rather than restyles:

```css
:root {
  --ui-modal-enter: 350ms;
  --ui-modal-exit: 200ms;
}
```

`prefers-reduced-motion` drops both to 1ms rather than `none`: the exit is
*awaited*, and a transition that never started is one there is nothing to wait
for.

> [!important]
> **Keep the modal mounted across the close.** `Modal` can only animate its exit
> while the element is still in the document, so drive `open` and leave the
> component where it is. `<Show when={sheet()}>{() => <Modal open …>}</Show>`
> unmounts the dialog the instant the value goes null, and the exit silently
> does not play. Put the `Show` *inside* the modal instead, or hold the last
> value in a signal.

#### Overriding a `Modal` default: plain utilities, never `base:` ones

`Modal`'s defaults are `base:`-prefixed, which compiles to `:where(…)` and
therefore **zero specificity** — the whole point being that a caller's utility
wins. That only holds when the caller's utility is *plain*.

A `base:` one on the same property ties, and a tie is resolved by **Tailwind's
stylesheet order**, which is neither the order of the `class` attribute nor
anything the call site can see. Measured in `cire/invites`' built CSS,
`.base\:max-w-ui-sm` is emitted after `.base\:max-w-lg`, so the component beat
its own caller — silently, with every string assertion still passing.

```tsx
// Right: a plain utility beats `:where(…)` every time.
<Modal class="max-w-lg bg-bg" …>

// Wrong: ties with Modal's own, resolved by stylesheet order.
<Modal class="base:max-w-lg base:bg-bg" …>
```

`house/no-base-variant-at-call-site` reports it at `error`, so the mistake is
caught rather than remembered. Where a dialog's rendered size or surface is
load-bearing, pin it in the browser tier as well — the defect is invisible to
anything that reads a class attribute, and
`cire/invites/tests/components/consent/consent-dialog-surface.browser.test.tsx`
is the worked example.

Same rule for any `base:`-styled component, not just `Modal`. The prefix belongs
to a component's own defaults; a caller writes plain utilities.

#### `frame`, for a panel that must not scroll

The default shape is the simple one: the panel scrolls and the panel is padded.
That breaks the moment something has to stay put while the body moves under it —
a close button in the corner, a sticky action bar at the foot — because a child
of the scrollport scrolls away with the content, and a `position: sticky` bottom
bar resolves its offset against the scrollport rather than against its parent.

`frame` drops the panel's own padding and overflow and makes it a column flex
container, so a child owns the scrollport and the furniture sits beside it. The
child needs its own `min-h-0`, or it cannot shrink under the panel's
`max-height` and nothing scrolls.

One detail worth carrying: `frame` sets `p-0` rather than merely omitting the
padding. **The user-agent stylesheet gives every `<dialog>` `padding: 1em`**, so
a component that writes no padding rule ships a 16px band its caller cannot see
in its own markup.

#### What has to sit above a modal — and why a `z-index` will not do it

The top layer is the reason to use `Modal`, and it is also the trap. It paints
above every stacking context **by definition**, so nothing outside it can be
raised over an open dialog at any number. Anything that must appear over a sheet
has to join the top layer, and there are exactly two doors:

| Element | Enters the top layer by | Painting order |
|---|---|---|
| A dialog | `showModal()` | Entry order — later entries paint on top |
| Anything else | `showPopover()` on a `popover` element | Same |

So a menu or a toast raised *after* a dialog opened paints above it. That is the
whole mechanism, and it is enough for paint.

> [!warning]
> **The top layer is no exemption from `inert`.** A modal dialog makes every
> node outside it inert — not hit-testable, not reachable by assistive
> technology — however it is painted. A popover shown outside the dialog is
> therefore *visible and dead*.
>
> Only a descendant of the dialog escapes that. A menu opened from inside a
> sheet must render **in place**, with `popover` doing the job a `<Portal>` used
> to: out of every ancestor stacking context, without leaving the dialog. A
> container mounted once at the page root — a toaster — cannot be a descendant
> of anything, so a toast raised over a modal is seen and nothing more, and has
> to be a confirmation the dialog itself also states.

Both of these are live in `cire/invites`: `AddToCalendar` renders in place as a
popover, and `@shared/toast`'s `Toaster` takes a `topLayer` flag that shows the
container as a popover while it has something to show
([[wiki/systems/toast]] §`topLayer`). `cire/invites/src/lib/z-index.ts`
documents what is left for numbers to decide, which is everything that is not a
dialog.

Three consequences for tests, each of which fails in a way that reads as a
component bug:

- **jsdom implements no part of `<dialog>`.** `showModal` is `undefined`, not
  inert; `Modal` degrades to a non-modal dialog, and Escape, the backdrop,
  modality and the focus restore cannot be asserted at all. Assert the wiring by
  dispatching the `close` event the platform would have fired, and put the
  gestures in the browser tier ([[wiki/conventions/browser-tests]]).
- **A dialog left open outlives its test.** `document.querySelector("dialog")`
  then finds the previous test's sheet rather than this one's, so a browser file
  rendering dialogs needs `afterEach(cleanup)`.
- **`getBoundingClientRect()` is post-transform**, and `Modal` animates in from
  `translateY(24px) scale(0.98)`. A rect read before the entry transition
  finishes is the layout box moved and scaled, and every comparison against
  `clientWidth` or `offsetLeft` is wrong by that much. Wait it out —
  `await Promise.allSettled(panel.getAnimations({ subtree: true }).map((a) => a.finished))`
  — after one frame, so the transition has actually started.

The motion itself is benched in `@tools/lab` under **shared/ui/overlays →
ModalMotion**, with the two durations on sliders. Whether a curve looks right is
not a question a test can answer; whether the exit *runs*, and whether the
dialog stays in the top layer until it finishes, are — and
`shared/ui/tests/modal.browser.test.tsx` asserts both.

## CSS Theme Variables

Components reference CSS variables defined in each app's root CSS (e.g. `pulse/web/src/app.css`). The variable naming follows the shadcn convention:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --radius: 0.625rem;
}
```

Tailwind maps these via `@theme inline` to utility classes (`bg-primary`, `text-muted-foreground`, etc.). Dark mode overrides go in `.dark {}`.

**Any new app** that uses `@shared/ui` components must define these CSS variables in its root stylesheet. Copy from `pulse/web/src/app.css` as the starting point.

## Adding a New Component

1. Create the file in `shared/ui/src/ui/<name>.tsx`
2. Follow the existing pattern: `splitProps` for `class`, write `base:` prefixed defaults literally in the class string, use `clsx()` to compose them with `local.class`, spread `...others`
3. For interactive components, use Kobalte primitives from `@kobalte/core/<name>`
4. For variant components, use CVA with a literal `base:` prefixed string for each variant, and export both the component and the `variants` function
5. For internal child elements that don't accept consumer `class` overrides, write the `base:` prefixed string directly (no `clsx` needed)
6. Add a subpath export in `shared/ui/package.json`:
   ```json
   "./ui/<name>": "./src/components/ui/<name>.tsx"
   ```
7. No barrel file needed — consumers import individual components by path

## Testing Considerations

- Components render standard HTML — tests use `@solidjs/testing-library` with role/label queries
- **Kobalte portals**: Dialog and Popover content is portaled to `<body>`. Use `screen.queryByText()` (searches full document) instead of `container.querySelector()` (searches render container only)
- **`base:` prefixed class selectors**: Component default classes are prefixed with `base:` in the DOM (e.g. `base:relative` instead of `relative`). CSS selectors must escape the colon: `span.base\\:relative`. Consumer-provided classes (via `class` prop) are NOT prefixed and can be selected normally
- **Avatar DOM structure**: The `Avatar` wrapper has `base:relative` class. The fallback text is inside a nested `<span>`. Tests that find avatars should use `span.base\\:relative`
- **Close-friend ring**: Applied to the outer `Avatar` wrapper via `clsx()` (not prefixed — it's a consumer class), not to the inner `<img>` or fallback `<span>`

## Source Files

- [shared/ui/src/ui/](../../shared/ui/src/ui/) — all component source
- [shared/ui/src/lib/utils.ts](../../shared/ui/src/lib/utils.ts) — `clsx`, `cn()`
- [shared/ui/package.json](../../shared/ui/package.json) — subpath exports
- [pulse/web/src/app.css](../../pulse/web/src/app.css) — CSS variable theme + `@custom-variant base`
