/**
 * The demo's bottom sheet.
 *
 * It used to be a 130-line port of `cire/invites`' `AnimatedModal`: a
 * `fixed inset-0` scrim, a 40-line `Tab` focus trap, Escape handling, a body
 * scroll lock, focus restore, and an enter/exit animation lazily imported from
 * `Modal.motion`. `@osn/ui`'s `Modal` supplies all of it — the trap, Escape and
 * inertness from `showModal()`, the top layer instead of a `z-index`, and the
 * motion from its own stylesheet.
 *
 * The exit is the part worth knowing about. `close()` drops a dialog out of the
 * top layer immediately, so a CSS-only exit has nothing to paint, and the
 * platform's fix for that — the `overlay` property — is Chrome and Edge only.
 * `Modal` defers the `close()` call instead, which is why this still fades out
 * in Safari. See `wiki/architecture/component-library.md`.
 *
 * What is left here is the sheet's own shape: bottom-anchored on a phone,
 * centred above `md`, and a close button in the corner.
 */

import Button from "@cire/ui/button";
import { Modal } from "@osn/ui/ui/modal";
import type { JSX } from "solid-js";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: JSX.Element;
}

export function DemoModal(props: DemoModalProps) {
  return (
    // `mt-auto mb-0` overrides the UA's `margin: auto` on a modal dialog so the
    // sheet sits on the bottom edge of a phone; `md:m-auto` hands it back for
    // the centred desktop presentation. A `max-w` in `px` rather than a
    // contract step because this is one fixed sheet width, not a scale.
    <Modal
      open={props.open}
      onClose={props.onClose}
      labelledBy={props.labelledBy}
      class="base:border-border base:bg-surface base:relative base:mt-auto base:mb-0 base:max-h-[85dvh] base:w-full base:max-w-[480px] base:overflow-y-auto base:overscroll-contain base:rounded-t-[1.75rem] base:rounded-b-none base:px-6 base:pt-8 base:pb-[max(2.5rem,env(safe-area-inset-bottom))] md:base:m-auto md:base:max-h-[85vh] md:base:rounded-lg md:base:pb-10"
    >
      <Button
        variant="bare"
        size="icon"
        aria-label="Close"
        onClick={props.onClose}
        class="absolute top-2 right-2 h-11 w-11"
      >
        &times;
      </Button>
      {props.children}
    </Modal>
  );
}
