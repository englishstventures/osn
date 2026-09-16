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
 *
 * ## Keep it mounted across the close
 *
 * The one thing a caller has to get right. `Modal` animates its exit, and it
 * can only do that while the element is still in the document — so drive
 * {@link ModalProps.open} and leave the component mounted:
 *
 * ```tsx
 * // Right: the modal stays, `open` moves.
 * <Modal open={sheet() !== null} onClose={() => setSheet(null)} label="…">
 *   <Show when={sheet()}>{(s) => <Body sheet={s()} />}</Show>
 * </Modal>
 *
 * // Wrong: `Show` unmounts the dialog the instant `sheet()` goes null, so the
 * // exit has nothing left to play and the sheet blinks away.
 * <Show when={sheet()}>{(s) => <Modal open onClose={…}>…</Modal>}</Show>
 * ```
 *
 * The wrong form is not broken — it closes, restores focus and leaves nothing
 * inert — it just loses the animation, silently. If the content genuinely
 * cannot render without the value that just became null, hold the last one:
 * that is one `createSignal` against an exit that plays.
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
 * The stylesheet `Modal` injects once per document.
 *
 * Two things live here rather than in Tailwind utilities. The backdrop is a
 * `::backdrop` pseudo-element, which cannot be targeted by a class on the
 * element; and the entry/exit choreography needs `@starting-style`, which has
 * no utility form either. Both are scoped to `.osn-modal` rather than to
 * `dialog` so an app's own `<dialog>` elements are left alone.
 *
 * ## The backdrop mixes the app's ground rather than using black
 *
 * `color-mix` against `--osn-ground-deep`: on a light theme a black scrim reads
 * as a hole punched in the page, and on a dark one it is nearly invisible.
 * Mixing the app's own ground keeps the scrim in the same family as whatever it
 * is dimming.
 *
 * ## Entry is pure CSS. Exit cannot be.
 *
 * Entry is `@starting-style`, which needs no JavaScript at all: the browser
 * takes the from-state at the moment the element is first rendered. Safari has
 * had it since 17.5; older engines simply show the dialog immediately, which is
 * a degradation rather than a broken state.
 *
 * Exit is the part that has to be held open from JavaScript, and it is worth
 * saying exactly why, because the CSS-only answer looks like it should work.
 * `close()` removes the dialog from the top layer *immediately*, so an exit
 * transition has nothing left to paint. The platform's fix is the `overlay`
 * property with `transition-behavior: allow-discrete`, which defers that
 * removal — and `overlay` is **Chrome and Edge only**, unsupported in Safari
 * and Firefox. On the surface this component was built for, cire's guest site,
 * most traffic is mobile Safari, so a CSS-only exit would mean the dialog
 * blinking away for nearly everyone who sees it.
 *
 * So `close()` is deferred in `Modal` instead: it sets `data-closing`, lets
 * these rules run, and calls `close()` once the element's own animations have
 * finished. No `overlay`, no `allow-discrete`, and the same behaviour in every
 * engine.
 *
 * ## The durations are tokens
 *
 * An app that wants different timing sets `--osn-modal-enter` / `--osn-modal-exit`
 * rather than restyling the component. The defaults are cire's existing modal
 * choreography, which is the only hand-rolled one this replaces.
 */
const MODAL_STYLE = `
.osn-modal::backdrop {
  background-color: color-mix(in srgb, var(--osn-ground-deep, #18181b) 72%, transparent);
  opacity: 0;
  transition: opacity var(--osn-modal-exit, 200ms) ease-in;
}
.osn-modal[open]::backdrop {
  opacity: 1;
  transition: opacity var(--osn-modal-enter, 250ms) ease-out;
}
@starting-style {
  .osn-modal[open]::backdrop { opacity: 0; }
}

.osn-modal {
  opacity: 1;
  transform: none;
  transition:
    opacity var(--osn-modal-enter, 250ms) cubic-bezier(0.22, 1, 0.36, 1),
    transform var(--osn-modal-enter, 350ms) cubic-bezier(0.22, 1, 0.36, 1);
}
@starting-style {
  .osn-modal[open] {
    opacity: 0;
    transform: translateY(24px) scale(0.98);
  }
}

/* After \`[open]\` in source order, so it wins on equal specificity. This is the
   state \`Modal\` holds the element in while it waits for the exit to finish. */
.osn-modal[data-closing] {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
  transition:
    opacity var(--osn-modal-exit, 200ms) ease-in,
    transform var(--osn-modal-exit, 200ms) ease-in;
}

/* Near-zero rather than \`none\`: the exit is awaited, and a transition that was
   never started is one there is nothing to wait for. 1ms keeps the code path
   identical and the motion imperceptible. */
@media (prefers-reduced-motion: reduce) {
  .osn-modal,
  .osn-modal[open],
  .osn-modal[data-closing],
  .osn-modal::backdrop,
  .osn-modal[open]::backdrop {
    transition-duration: 1ms;
  }
}
`;

let styleInjected = false;

function injectModalStyle(): void {
  // Once per document, not once per instance: several modals mounted at the
  // same time would otherwise each add an identical rule.
  if (styleInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset.osnModal = "";
  style.textContent = MODAL_STYLE;
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

  injectModalStyle();

  /**
   * Which close this component is currently waiting out.
   *
   * A token rather than a boolean, so a reopen during an exit can invalidate
   * the pending close without cancelling anything: the awaiting code compares
   * the token it captured against this one and does nothing if they differ.
   * Without it, opening a dialog again while it is still fading out would let
   * the old close land a moment later and shut the newly-opened dialog.
   */
  let closingToken = 0;

  createEffect(() => {
    const dialog = ref;
    if (!dialog) return;

    // `showModal()` on an already-open dialog throws, and `close()` on a closed
    // one is a silent no-op that still fires nothing — so both directions are
    // guarded by the element's own state rather than by tracking our own.
    if (own.open) {
      // Reopening cancels any exit still in flight, and clears the attribute so
      // the entry rules apply to an element that is not still mid-fade.
      closingToken++;
      dialog.removeAttribute("data-closing");
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      void closeWhenAnimationsFinish(dialog);
    }
  });

  /**
   * Close the dialog, but not until whatever is animating it has finished.
   *
   * `close()` removes a dialog from the top layer immediately, so an exit
   * animation has nothing left to paint. The platform's own answer is the
   * `overlay` property with `transition-behavior: allow-discrete`, which defers
   * that removal — and `overlay` is Chrome and Edge only. Deferring the call
   * instead gets the same result in every engine.
   *
   * `getAnimations({ subtree: true })` rather than a `transitionend` listener,
   * and deliberately not tied to CSS: it returns whatever is actually running
   * on the element and its descendants, so an app animating the panel with
   * Motion One or the Web Animations API is waited out exactly the same way as
   * this component's own transitions. That is what keeps the hook
   * animation-library-agnostic without naming a library.
   */
  async function closeWhenAnimationsFinish(dialog: HTMLDialogElement): Promise<void> {
    const token = ++closingToken;
    dialog.setAttribute("data-closing", "");

    // Reading a layout property flushes the pending style change, so the exit
    // transition has actually STARTED by the time we ask what is running. Skip
    // this and `getAnimations()` comes back empty, the dialog closes on the
    // spot, and the animation this whole function exists for never plays.
    void dialog.offsetHeight;

    await Promise.allSettled(dialog.getAnimations({ subtree: true }).map((a) => a.finished));

    // A reopen, a second close, or an unmount happened while we waited. Any of
    // them owns the element now.
    if (token !== closingToken || !dialog.isConnected) return;

    dialog.removeAttribute("data-closing");
    if (dialog.open) dialog.close();
  }

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
    // outside it swallowed, with nothing visible to explain why. This closes
    // straight away rather than waiting out an exit: there is nothing left to
    // animate on an element that is about to be removed, and `closingToken`
    // moving is what tells any in-flight close to stand down.
    closingToken++;
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
