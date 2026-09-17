import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../src/styles/global.css";
import { DetailsModal } from "../../src/components/DetailsModal";
import type { EventSummary } from "../../src/components/types";

/**
 * The venue address in the details sheet's map footer, measured.
 *
 * `MapPreview.test.tsx` pins the *mechanism* — that the address carries no
 * `truncate` and does carry the wrap and clamp utilities. This file pins the
 * *outcome*, and it has to exist because the two are not the same claim:
 *
 *   - Truncation clips **visually** and leaves the text node whole, so
 *     `getByText("12 Banksia Lane, Strathfield")` passes identically whether the
 *     address is painted in full or cut off after "12 Ban…". jsdom parses no
 *     stylesheet and computes no layout, so nothing in the fast tier can tell
 *     those apart.
 *   - The class-contract assertion is a statement about source text. It cannot
 *     see a *different* clipping mechanism arriving — an ancestor's
 *     `overflow: hidden`, a `max-height`, or two conflicting utilities resolving
 *     by stylesheet order rather than by class-attribute order.
 *
 * So the assertions below read computed style and real geometry, which is the
 * only thing that distinguishes "the text is in the DOM" from "the guest can
 * read it".
 *
 * ## Why it renders `DetailsModal` rather than `MapPreview`
 *
 * The width the address gets is decided by a chain that starts outside the
 * component: the dialog's `max-w-[480px]`, the scrollport's `px-6`, the card's
 * border, then the footer's own `px-4` and `gap-3`. Rendering `MapPreview` bare
 * would measure a column no guest ever sees. `DetailsModal` is its only render
 * site.
 *
 * ## Why only the CSS-card branch
 *
 * The card branch is the strictly narrower column at every width — it is the one
 * that still carries the "Open in Maps" affordance, which takes 140px of the
 * footer — so an address that fits here fits in the iframe branch by
 * construction. Forcing the iframe branch would also make a real Chromium fetch
 * `www.google.com/maps/embed` on every run of this tier, and a test that needs
 * the network to be up is a test that goes red when it is not. The iframe
 * branch's own claim — that its footer holds no control — is a DOM fact, and
 * `MapPreview.test.tsx` proves it completely.
 *
 * ## The three widths
 *
 * 320 / 768 / 1440 are the widths the acceptance criterion names. Note that the
 * panel is 480px wide at both 768 and 1440 (`max-w-[480px]`), so those two are
 * not independent layout cases — but they are not identical measurements
 * either, because the type scale is fluid: line-height and the footer's content
 * box both move between them. Every figure below is read off the element at the
 * width under test for that reason; nothing here hard-codes a pixel.
 */

const ADDRESS = "12 Banksia Lane, Strathfield";

const event: EventSummary = {
  id: "event-1",
  name: "Mehndi",
  description: "An evening of henna",
  startAt: "2026-09-18T16:00:00+10:00",
  endAt: "2026-09-18T22:00:00+10:00",
  timezone: "Australia/Sydney",
  address: ADDRESS,
  dressCodeDescription: null,
  dressCodePalette: null,
  pinterestUrl: null,
  mapsUrl: null,
  sortOrder: 0,
  imageUrl: null,
};

/**
 * Open the sheet at `width` and hand back the footer's three parts, settled.
 *
 * The viewport is set **before** the render, not after: it persists for the rest
 * of the file, and a sheet rendered at the previous width would play its entry
 * transition against a box that is about to change.
 *
 * Then three waits, each for a different reason. A frame, because the entry
 * transition has not started until the initial style has been resolved and
 * `getAnimations()` before that comes back empty. The animations themselves,
 * because `Modal` enters from `translateY(24px) scale(0.98)` and
 * `getBoundingClientRect()` reports the POST-transform box. And
 * `document.fonts.ready`, because Lato is self-hosted and a line count measured
 * against the fallback metrics is a different number.
 */
async function open(width: number) {
  await page.viewport(width, 900);

  const view = render(() => (
    <DetailsModal event={event} siteUrl="https://invite.test/abc-123" onClose={() => {}} />
  ));

  const panel = document.querySelector("dialog") as HTMLElement;
  await new Promise(requestAnimationFrame);
  await Promise.allSettled(panel.getAnimations({ subtree: true }).map((a) => a.finished));
  await document.fonts.ready;

  // No build-time embed key under vitest, so this is the CSS-card branch. It is
  // asserted rather than assumed: with a key present the iframe would render
  // instead, and every measurement below would silently be of the other, wider
  // branch.
  expect(document.querySelector("iframe"), "expected the CSS-card branch").toBeNull();

  const address = view.getByText(ADDRESS);
  const action = view.getByText(/open in maps/i);
  const footer = address.parentElement as HTMLElement;
  return { address, action, footer };
}

describe.each([320, 768, 1440])("the venue address at %ipx", (width) => {
  afterEach(cleanup);

  it("is not clipped in either axis", async () => {
    // The assertion that actually means "not truncated". `line-clamp` and
    // `truncate` both work by `overflow: hidden`, so a clipped address is one
    // whose scroll box is bigger than its visible box — in the block axis when
    // it has more lines than the clamp allows, in the inline axis when a long
    // token has nowhere to break.
    const { address } = await open(width);

    expect(address.scrollHeight).toBeLessThanOrEqual(address.clientHeight + 1);
    expect(address.scrollWidth).toBeLessThanOrEqual(address.clientWidth + 1);
  });

  it("is laid out to wrap rather than to run on one line", async () => {
    // Read from the computed cascade, not from the class attribute: this is the
    // exact declaration `truncate` set, and it is gone whatever route it might
    // have arrived by.
    const { address } = await open(width);

    expect(getComputedStyle(address).whiteSpace).not.toBe("nowrap");
  });

  it("keeps the action on the address's row, inside the footer", async () => {
    // "Stays on its row and does not overflow", as two measurements: the footer
    // has nothing hidden off its inline edge, and the action's box overlaps the
    // address's vertically — which is what sharing a row means once the address
    // is several lines tall and the action is one.
    const { address, action, footer } = await open(width);

    expect(footer.scrollWidth).toBeLessThanOrEqual(footer.clientWidth + 1);

    const footerBox = footer.getBoundingClientRect();
    const addressBox = address.getBoundingClientRect();
    const actionBox = action.getBoundingClientRect();

    expect(actionBox.right).toBeLessThanOrEqual(footerBox.right + 1);
    expect(actionBox.left).toBeGreaterThanOrEqual(footerBox.left - 1);
    expect(actionBox.top).toBeLessThan(addressBox.bottom);
    expect(actionBox.bottom).toBeGreaterThan(addressBox.top);
  });
});

describe("the venue address in the narrowest column", () => {
  afterEach(cleanup);

  it("genuinely wraps at 320px rather than happening to fit", async () => {
    // Without this the "not clipped" assertions above pass for the wrong reason
    // at every width — an address that fits on one line is trivially unclipped,
    // and the bug this file exists to catch is about the addresses that do not.
    // 320px is where the fallback branch's column is 83px wide.
    const { address } = await open(320);

    const lineHeight = parseFloat(getComputedStyle(address).lineHeight);
    expect(Number.isFinite(lineHeight)).toBe(true);
    expect(address.getBoundingClientRect().height).toBeGreaterThan(lineHeight * 1.5);
  });
});
