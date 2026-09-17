/**
 * Single source of truth for the guest site's stacking order.
 *
 * Every overlay/floating element in `cire/invites` should pull its `z-index` from
 * here rather than hardcoding a `z-<n>` utility at the call site. Centralising
 * the order is what stops a future overlay from silently regressing the layer
 * stack — the failure mode that produced #203, where the Add-to-Calendar
 * popover shipped at `z-90`, *below* the `z-100` modal, and rendered behind the
 * modal backdrop (invisible + unclickable: "Add to Calendar doesn't work").
 *
 * ## The layers (low → high)
 *
 * | Layer           | z   | What sits here                                          |
 * | --------------- | --- | ------------------------------------------------------- |
 * | `BASE`          | 0   | Normal page flow — hero, story, event grid (default).   |
 * | `EVENT_CARD`    | 10  | An event card's own local stacking context.             |
 * | `STICKY_RAIL`   | 20  | The gift list's sticky return rail.                     |
 * | `MODAL_POPOVER` | 110 | The Add-to-Calendar menu.                               |
 * | `TOAST`         | 150 | Confirmation toasts (`@shared/toast` `<Toaster>`).       |
 * | `CONSENT`       | 200 | Site-wide consent banner (`ConsentBanner`).             |
 *
 * ## There is no modal layer, and that is the point
 *
 * The details and RSVP sheets are `@osn/ui`'s `Modal`, a `<dialog>` opened with
 * `showModal()`, and such a dialog paints in the **top layer** — above every
 * stacking context in the document, by definition, whatever number anything
 * else carries. So no entry here can rank against a sheet, and one that
 * claimed to would be making a promise this scale cannot keep.
 *
 * That is the trap to understand before adding anything that must appear over a
 * sheet. Two things in this app must:
 *
 * - The **Add-to-Calendar menu**, opened from inside the details sheet. It
 *   shows itself as a `popover`, which enters the top layer too — and top-layer
 *   order is ENTRY order, so a popover shown after the dialog opened paints
 *   above it. `MODAL_POPOVER` stays on the element for the other case, where
 *   the menu is opened from an event card and is competing with the page.
 * - The **save toast**, raised while the RSVP sheet is still up for its dwell.
 *   `@shared/toast`'s `topLayer` does the same thing for the toast container:
 *   it enters the top layer as the first toast arrives, so it lands above a
 *   sheet that was already open. Its `z-index` still matters for everything
 *   NOT in the top layer, which is the bound below.
 *
 * ## The invariants
 *
 * A toast MUST sit below consent, i.e. `TOAST < CONSENT`. That is easy to lose:
 * a "just make it big" z-index satisfies every lower bound while violating this
 * upper one — which is exactly what the previous library's hardcoded 9999 did —
 * so `InvitePage.browser.test.tsx` asserts the measured value against both
 * bounds rather than just "above the page".
 *
 * A toast must also clear ordinary page furniture, and the `<Toaster>` must be
 * mounted at the page root rather than inside the events section, whose Motion
 * One transform makes it a stacking context that no `z-index` can escape.
 *
 * The consent banner sits above every OTHER numbered layer, deliberately and
 * with a wide gap. It is the guest's route to granting — or later withdrawing —
 * permission for third-party content, and a consent control the guest cannot
 * reach is worse than no control at all, because the stored record would then
 * assert a freely-given choice they had no practical way to change.
 *
 * `every other NUMBERED layer` is the exact claim, and the qualifier is the
 * important half. A sheet is a `showModal()` dialog in the top layer, so while
 * one is open the banner is painted beneath it AND inert — not clickable, not
 * announced — and comes back when the sheet closes. The gap that leaves is
 * `xchromo/osn#1061`: not reachability (Escape closes the sheet) but the
 * absence of a consent affordance beside a third-party embed the guest is
 * looking at right then.
 *
 * The preferences DIALOG is unaffected, and is in a stronger position than a
 * number could put it: it is an `@osn/ui` `Modal` too, so opening it from
 * inside a sheet makes it the blocking dialog and the sheet goes inert beneath
 * it. It has no layer here because it has nothing left to rank against.
 *
 * ## Tailwind v4 note
 *
 * Tailwind v4 generates `z-<integer>` utilities dynamically, but only for the
 * literal class strings its scanner can see in source. The full literals
 * (`"z-100"`, `"z-110"`, …) are therefore spelled out below as constants so the
 * scanner emits the matching CSS; components reference these constants instead
 * of writing the magic number inline. Do NOT build these class names by
 * concatenation (e.g. `` `z-${TOAST}` ``) — the scanner can't follow that and
 * the utility would be dropped from the build.
 */

/** Numeric stacking values, ordered low → high. The relative order is the contract. */
export const Z_LAYER = {
  /** Normal page flow (hero, story, event grid). */
  BASE: 0,
  /** An event card's own local stacking context. */
  EVENT_CARD: 10,
  /**
   * A sticky page rail — today the gift list's return link, which stays put
   * while the list scrolls under it. Must be > EVENT_CARD and > BASE: every
   * card on that page paints a background of its own and is LATER in the
   * document, so without a layer of its own the rail is painted over by the
   * list it is meant to float above. Below every overlay, like all page
   * furniture.
   */
  STICKY_RAIL: 20,
  /**
   * The Add-to-Calendar menu. Named for where it is usually opened from —
   * inside the details sheet — though that case is now settled by the top
   * layer rather than by this number; see the note above. What the number
   * still decides is the other case: the same menu opened from an event card,
   * where it has to clear the cards and the sticky rail.
   */
  MODAL_POPOVER: 110,
  /**
   * Transient confirmation toasts (`@shared/toast`'s `<Toaster>`). Must stay
   * < CONSENT — see the invariants above. Above a sheet is the top layer's
   * job, not this number's.
   *
   * Applied as `class={Z_CLASS.TOAST}`, like every other layer here.
   *
   * That is worth a note because it used not to work. `solid-toast` spread its
   * own `defaultContainerStyle` onto the container's inline `style`, and that
   * carried a hardcoded `z-index: 9999`; inline style beats a Tailwind utility,
   * so `containerClassName={Z_CLASS.TOAST}` was silently inert and the toast
   * landed at 9999 — above the consent layers, the one place it must never be.
   * The only override that won was `containerStyle`. `@shared/toast` sets no
   * `z-index` at all, precisely so the layer is the consumer's to state; the
   * two-sided bound in `InvitePage.browser.test.tsx` is what keeps it honest.
   */
  TOAST: 150,
  /** Site-wide consent banner. Above every page overlay. */
  CONSENT: 200,
} as const;

export type ZLayer = keyof typeof Z_LAYER;

/**
 * Matching Tailwind class strings — the literals the v4 scanner picks up.
 * Apply via `class={Z_CLASS.TOAST}` (or compose with other utilities).
 */
export const Z_CLASS = {
  BASE: "z-0",
  EVENT_CARD: "z-10",
  STICKY_RAIL: "z-20",
  MODAL_POPOVER: "z-110",
  TOAST: "z-150",
  CONSENT: "z-200",
} as const satisfies Record<ZLayer, string>;
