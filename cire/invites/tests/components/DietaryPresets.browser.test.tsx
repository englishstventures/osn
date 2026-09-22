import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../src/styles/global.css";
import { RsvpModal } from "../../src/components/RsvpModal";
import type { EventSummary, FamilyMember } from "../../src/components/types";

/*
 * The dietary picker inside the sheet it actually ships in, measured.
 *
 * Four claims live here because nothing below the browser tier can check them.
 *
 * **The track overflows inside the sheet, not the other way round.** A
 * `<fieldset>` resolves its min-width from its content, so sixteen pills will
 * push the whole sheet wider than the phone unless every box between them and
 * the scrollport is allowed to be narrower than what it holds. happy-dom
 * computes no layout and cannot tell the two apart — the classes are identical
 * either way.
 *
 * **The picker stays inline at every width here.** The sheet is a `frame`
 * Modal, whose dialog is `overflow-clip`. `@shared/ui`'s popover mounts its
 * panel into the open dialog — which is what clears the top layer a
 * `showModal()` dialog occupies — and inside a `frame` dialog that puts it in
 * the clip instead. `RsvpModal` therefore imports `@cire/ui/dietary-presets`,
 * the entry point with no popover in it, rather than the popover shell the host
 * portal uses. This is where that is checked against a real viewport rather than
 * a stubbed `matchMedia`.
 *
 * **Ticking a pill does not move the sheet.** Each pill hides a real checkbox
 * behind `sr-only`, which is `position: absolute` — so unless the pill itself
 * is a containing block, that input resolves against whatever box is positioned
 * further up and does not travel with the track's sideways scroll. Focusing it
 * then asks the browser to scroll toward a position hundreds of pixels outside
 * the sheet, and the browser obliges by scrolling the `<dialog>`. Measured on
 * the parent of this commit: `dialog.scrollLeft` went 0 → 1213 at 1024px and
 * 0 → 1182 at 414px, and never came back.
 *
 * **The close chip stays on top.** Making each pill `position: relative` is
 * what fixes the above, and it also promotes sixteen boxes past the chip, which
 * is an earlier-in-tree positioned sibling of the scroller with nothing but
 * tree order holding it up. Only a hit test can see that.
 */

/** Wide enough to clear the picker's 48rem query with room to spare. */
const WIDE: readonly [number, number] = [1024, 900];
/** The tester iframe's own default, restored after any test that widens it. */
const NARROW: readonly [number, number] = [414, 896];

const event: EventSummary = {
  id: "event-1",
  name: "Mehndi",
  description: "Henna evening",
  startAt: "2026-09-18T16:00:00+10:00",
  endAt: "2026-09-18T22:00:00+10:00",
  timezone: "Australia/Sydney",
  address: "12 Banksia Lane",
  dressCodeDescription: null,
  dressCodePalette: null,
  pinterestUrl: null,
  mapsUrl: null,
  sortOrder: 0,
  imageUrl: null,
};

const priya: FamilyMember = {
  guestId: "guest-priya",
  firstName: "Priya",
  lastName: "Sharma",
  nickname: null,
  eventIds: ["event-1"],
};

afterEach(async () => {
  cleanup();
  await page.viewport(...NARROW);
});

/** Mount the sheet and put Priya in the attending state that reveals the picker. */
function openAttending() {
  const utils = render(() => (
    <RsvpModal event={event} members={[priya]} apiUrl="https://api.test" onClose={() => {}} />
  ));
  const fieldset = screen.getByRole("group", { name: /priya sharma/i }) as HTMLElement;
  fireEvent.click(within(fieldset).getByText("Attending"));
  return { ...utils, fieldset };
}

/**
 * Let the sheet's entry finish.
 *
 * `Modal` enters from `translateY(24px) scale(0.98)`, and a frame asked for
 * before the initial style has resolved reports no animations at all — so the
 * frame comes first and the animations after it.
 */
async function settle() {
  await new Promise(requestAnimationFrame);
  const panel = document.querySelector("dialog") as HTMLElement;
  await Promise.allSettled(panel.getAnimations({ subtree: true }).map((a) => a.finished));
}

/** Scroll the pill track to its far end, the way a guest reaching "Other" does. */
async function scrollTrackToEnd(fieldset: HTMLElement) {
  const group = within(fieldset).getByRole("group", { name: /dietary requirements/i });
  const track = group.firstElementChild as HTMLElement;
  track.scrollLeft = track.scrollWidth;
  await new Promise(requestAnimationFrame);
  // The guard is worthless against a track that never scrolled.
  expect(track.scrollLeft).toBeGreaterThan(0);
  return track;
}

describe("dietary picker, in the sheet", () => {
  it("shows the presets inline on a phone, with no control to open first", async () => {
    // The real query, at the iframe's own width. Answering is a tap, and a
    // control you must open before you can start is a tap spent on nothing.
    await page.viewport(...NARROW);
    const { fieldset } = openAttending();
    expect(within(fieldset).getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(
      within(fieldset).queryByRole("button", { name: /add dietary requirements/i }),
    ).toBeNull();
  });

  it("scrolls the preset track sideways without moving the sheet", async () => {
    await page.viewport(...NARROW);
    const { fieldset } = openAttending();
    const group = within(fieldset).getByRole("group", { name: /dietary requirements/i });
    const track = group.firstElementChild as HTMLElement;
    // Sixteen pills do not fit 414px, so the track must be the thing that
    // overflows — if it is not scrollable the tail is simply unreachable. And
    // the overflow must stay INSIDE it: a `<fieldset>` sizes to its content
    // unless told otherwise, and without `min-w-0` the pills push the whole
    // sheet wider than the phone instead.
    expect(track.scrollWidth).toBeGreaterThan(track.clientWidth);
    expect(group.clientWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it("stays inline on a desktop viewport, because the sheet is a `frame` modal", async () => {
    // Not the entry point the host portal imports. Rendering the trigger here
    // would ship a control whose panel opens inside the dialog's
    // `overflow-clip` and cannot be clicked — see xchromo/osn#1089.
    await page.viewport(...WIDE);
    const { fieldset } = openAttending();
    expect(within(fieldset).getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(
      within(fieldset).queryByRole("button", { name: /add dietary requirements/i }),
    ).toBeNull();
  });
});

describe("ticking a pill after scrolling the track", () => {
  for (const [name, size] of [
    ["desktop", WIDE],
    ["phone", NARROW],
  ] as const) {
    it(`leaves the sheet where it was, on ${name}`, async () => {
      await page.viewport(...size);
      const { fieldset } = openAttending();
      await settle();
      await scrollTrackToEnd(fieldset);

      const dialog = document.querySelector("dialog") as HTMLElement;
      const boxes = within(fieldset).getAllByRole("checkbox") as HTMLInputElement[];
      const last = boxes[boxes.length - 1] as HTMLInputElement;
      (last.closest("label") as HTMLElement).click();
      await new Promise(requestAnimationFrame);

      // The tick itself must still work — a guard that passes because nothing
      // happened is not a guard.
      expect(last.checked).toBe(true);

      // Two independent guards, because two separate changes hold this up and
      // either one alone would hide the other's regression.
      //
      // The cause: the hidden input must resolve inside its own pill, so that
      // it travels with the track and focusing it asks for a scroll of zero.
      expect(last.offsetParent).toBe(last.closest("label"));
      // The containment: the frame dialog is `overflow-clip`, so it has no
      // scroll offset for anything to move even if some future descendant
      // escapes its pill again.
      expect(dialog.scrollLeft).toBe(0);
      expect((document.querySelector("dialog [tabindex='0']") as HTMLElement).scrollLeft).toBe(0);
    });
  }
});

describe("the close chip", () => {
  it("stays above the pills, which are positioned boxes below it in the tree", async () => {
    await page.viewport(...WIDE);
    const { fieldset } = openAttending();
    await settle();
    await scrollTrackToEnd(fieldset);

    const chip = screen.getByRole("button", { name: /close/i });
    const box = chip.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    expect(chip.contains(hit)).toBe(true);
  });
});
