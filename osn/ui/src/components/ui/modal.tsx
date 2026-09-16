/**
 * A modal dialog, built on the platform's own `<dialog>` element.
 *
 * ## Why not Kobalte
 *
 * `@osn/ui` already ships a Kobalte-backed `Dialog`, and `@musubi/social` and
 * `@pulse/web` use it. This exists because `@cire/invites` and `@cire/landing`
 * carry no Kobalte at all, and **it does not fit**: measured 2026-09-16,
 * importing `@kobalte/core/dialog` costs 15.3 KB gzip on top of a bare Solid
 * bundle (2,270 → 17,564 bytes), against ~11.7 KB of headroom in each of those
 * two apps. Adopting it there would mean re-baselining the guest site's budget
 * by roughly 9% — on the surface people load on mobile data at a wedding.
 *
 * *Measured — `bun build <entry> --minify --target=browser` from `osn/ui`, with
 * and without the import, then `gzip -9`. Budgets in
 * `scripts/bundle-size-budgets.txt`.*
 *
 * Most of what that 15 KB buys is behaviour the browser now does natively.
 * `showModal()` gives a focus trap, Escape-to-close, background inertness and a
 * `::backdrop` pseudo-element, all from the platform. What is left is the part
 * below: reactive open/close, a close-on-backdrop-click that does not misfire,
 * and the accessible name.
 *
 * ## The top layer is the point, not a detail
 *
 * A `showModal()` dialog renders in the **top layer** — outside the normal flow
 * entirely. That makes it immune to the trap that has already cost this
 * repository a bug: a `transform` on any ancestor turns that ancestor into the
 * containing block for `position: fixed` descendants *and* into a stacking
 * context no `z-index` escapes. Motion One leaves its final inline `transform`
 * on everything it animates, which is what left cire's RSVP toast mispositioned
 * and painted underneath the sheet it fired beneath
 * (`wiki/architecture/frontend-patterns.md`). Nine hand-rolled overlays in this
 * repository are `position: fixed` inside a portal, each of them one animated
 * ancestor away from that. The top layer cannot be captured that way, so the
 * whole class of bug stops being possible rather than being avoided by
 * convention.
 *
 * It also means **no `z-index` and no portal**: the top layer paints above every
 * stacking context in the document by definition, and the element may live
 * wherever it is written.
 */

import { clsx } from "clsx";
import { createEffect, onCleanup, splitProps, type ComponentProps, type JSX } from "solid-js";

export type ModalProps = Omit<ComponentProps<"dialog">, "open" | "onClose" | "children"> & {
  /** Whether the dialog is showing. Reactive — set it false to close. */
  open: boolean;
  /**
   * Called whenever the dialog closes, from any cause: the Escape key, a
   * backdrop click, or a form submit inside it. Treat it as the single place
   * that flips `open` back to false — the element can close itself without
   * asking, so a caller that only clears `open` in its own button handler will
   * fall out of sync with the DOM the first time someone presses Escape.
   */
  onClose: () => void;
  /**
   * The accessible name. Required rather than optional: an unnamed dialog is
   * announced as just "dialog", which tells a screen-reader user that something
   * appeared and nothing about what.
   *
   * Pass `labelledBy` instead when a visible heading already says it, so the two
   * cannot drift.
   */
  label?: string;
  /** `id` of the element naming this dialog — a visible heading, usually. Wins over {@link ModalProps.label}. */
  labelledBy?: string;
  /** Whether clicking the backdrop closes it. Default `true`; turn it off for a dialog with unsaved input. */
  dismissable?: boolean;
  children: JSX.Element;
};

/**
 * The backdrop is styled through `::backdrop`, which cannot be targeted by a
 * Tailwind utility on the element, so it is a real stylesheet rule. Scoped to
 * the class below rather than to `dialog::backdrop` so an app's own `<dialog>`
 * elements are left alone.
 *
 * `color-mix` against the contract's ground rather than a flat `black/50`: on a
 * light theme a black scrim reads as a hole punched in the page, and on a dark
 * one it is nearly invisible. Mixing the app's own ground keeps the scrim in the
 * same family as whatever it is dimming.
 */
const BACKDROP_STYLE = `
.osn-modal::backdrop {
  background-color: color-mix(in srgb, var(--osn-ground-deep, #18181b) 72%, transparent);
}
`;

let styleInjected = false;

function injectBackdropStyle(): void {
  // Once per document, not once per instance: several modals mounted at the
  // same time would otherwise each add an identical rule.
  if (styleInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset.osnModal = "";
  style.textContent = BACKDROP_STYLE;
  document.head.append(style);
  styleInjected = true;
}

export function Modal(props: ModalProps) {
  const [own, rest] = splitProps(props, [
    "open",
    "onClose",
    "label",
    "labelledBy",
    "dismissable",
    "class",
    "children",
  ]);

  let ref: HTMLDialogElement | undefined;

  injectBackdropStyle();

  createEffect(() => {
    const dialog = ref;
    if (!dialog) return;

    // `showModal()` on an already-open dialog throws, and `close()` on a closed
    // one is a silent no-op that still fires nothing — so both directions are
    // guarded by the element's own state rather than by tracking our own.
    if (own.open && !dialog.open) dialog.showModal();
    else if (!own.open && dialog.open) dialog.close();
  });

  createEffect(() => {
    const dialog = ref;
    if (!dialog) return;

    /*
     * `close` is wired here rather than as an `onClose` JSX prop.
     *
     * It does not bubble, and it is not in Solid's delegated-event list, so
     * whether a JSX handler attaches at all depends on framework internals this
     * component should not be betting on. It cost a failing test to find:
     * Escape closed the element, nothing told the caller, and `open` stayed
     * true against a closed dialog — which is exactly the desync the handler
     * exists to prevent, arriving through the handler itself.
     *
     * This fires for every close: the Escape key, `close()`, and a
     * `<form method="dialog">` submit inside it.
     */
    const handleClose = () => own.onClose();
    dialog.addEventListener("close", handleClose);
    onCleanup(() => dialog.removeEventListener("close", handleClose));
  });

  onCleanup(() => {
    // A dialog unmounted while open leaves the document inert — every click
    // outside it swallowed, with nothing visible to explain why.
    if (ref?.open) ref.close();
  });

  return (
    // `<dialog>` is an interactive element and a click-the-backdrop-to-dismiss
    // handler is the standard way to build one; the rule reads the tag as
    // non-interactive and cannot see that. Nothing here is keyboard-only
    // functionality hidden behind a mouse event — Escape closes it, from the
    // platform, and the effect above reports that close like any other.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label={own.labelledBy ? undefined : own.label}
      aria-labelledby={own.labelledBy}
      onClick={(event) => {
        if (own.dismissable === false) return;
        // A click on the backdrop targets the dialog ITSELF — the backdrop is a
        // pseudo-element and cannot be an event target. Comparing against
        // `currentTarget` alone would therefore also close on any click that
        // reached the dialog's own padding, so the hit-test is against the
        // element's box: outside it means the backdrop.
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) own.onClose();
      }}
      class={clsx(
        "osn-modal",
        // No `z-index` and no `position`: a `showModal()` dialog is in the top
        // layer, above every stacking context in the document by definition.
        // `m-auto` is what centres it there — the UA default is `margin: auto`
        // on a modal dialog, and a utility that overrode it would drop the
        // dialog to the top-left corner.
        "base:m-auto base:max-h-[85vh] base:w-full base:max-w-osn-sm base:overflow-y-auto",
        "base:rounded-osn-lg base:border base:border-osn-hairline base:bg-osn-surface-raised",
        "base:p-6 base:text-osn-ink base:shadow-[var(--osn-elev-2)]",
        own.class,
      )}
      {...rest}
    >
      {own.children}
    </dialog>
  );
}
