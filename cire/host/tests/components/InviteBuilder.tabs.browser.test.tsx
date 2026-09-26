import { contrastRatio, WCAG_TEXT_MIN } from "@cire/theme";
import { cleanup, render, screen, waitFor, within } from "@solidjs/testing-library";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";

import "../../src/styles/global.css";

/**
 * The section nav's hidden labels, as painted.
 *
 * A hidden section's label is struck through and keeps the ink its shown
 * counterpart has, so it stays as readable as any other tab: 4.5:1, what WCAG
 * 1.4.3 asks of text this small (see `HIDDEN_LABEL` in
 * `src/components/invite/fields.tsx` for why a fade could not do both). The
 * fast tier proves the classes are on the label. It cannot prove the strike
 * class emits any CSS or wins the cascade, or that the ink still clears 4.5:1
 * once the portal's translucent inks are composited over the sticky bar, the
 * menu panel, the gold wash and the page. Those need a stylesheet and a
 * compositor.
 *
 * It mounts the real builder, so what is measured is what the nav renders, on
 * the ancestors it really has.
 */

// Declared inline, as `ImportPanel.browser.test.tsx` does: the browser runner
// cannot resolve a factory that imports `../test-support/mocks`.
const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("@shared/rp-auth/solid", () => ({ useAuth: () => ({ authFetch: authFetchMock }) }));
vi.mock("@shared/toast", () => ({ toast: { success: () => {}, error: () => {} } }));
vi.mock("../../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/api")>("../../src/lib/api");
  return {
    ...actual,
    apiUrl: (path: string) => `https://api.test${path}`,
    isAuthExpired: () => false,
    redirectToLogin: () => {},
  };
});
vi.mock("@cire/invite-designs", () => ({
  DESIGNS: [{ id: "classic", name: "Classic", tier: "free" }],
  DEFAULT_DESIGN_ID: "classic",
}));

import InviteBuilder from "../../src/components/invite/InviteBuilder";

/** Every switchable section empty, so Hero, Our Story and Closing are hidden. */
const EMPTY_CUSTOMISATION = {
  designId: "classic",
  hero: { title: null, subtitle: null, imageUrl: null },
  story: { eyebrow: null, heading: null, body: null, imageUrl: null },
  heroDisplay: { blur: 28, titleBackdrop: { opacity: 0, blur: 0 } },
  theme: {
    headingFont: null,
    bodyFont: null,
    palettePreset: null,
    palette: { ground: null, card: null, ink: null, gilt: null, bloom: null },
    tones: { hero: null, story: null, details: null, welcome: null },
  },
};

/**
 * The colour an element is painted ON — every ancestor background composited
 * in paint order, bottom-up. On a canvas because it composites the way the
 * browser does and parses whatever `getComputedStyle` hands back, including the
 * `oklab(… / .12)` that Tailwind's `/12` modifier computes to. Same method as
 * `ImportPanel.browser.test.tsx`.
 */
function paintedBackdrop(element: Element): string {
  const layers: string[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") layers.push(bg);
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  for (const layer of layers.toReversed()) {
    ctx.fillStyle = layer;
    ctx.fillRect(0, 0, 1, 1);
  }
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/** The ink an element is painted IN, composited over its own backdrop. */
function paintedInk(element: Element): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = paintedBackdrop(element);
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = getComputedStyle(element).color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

const ratioOn = (element: Element) => contrastRatio(paintedInk(element), paintedBackdrop(element))!;

/** Whether the element is painted with a strike through it. */
const struck = (element: Element) =>
  getComputedStyle(element).textDecorationLine.split(" ").includes("line-through");

/**
 * Transitions off, for this file only. It measures colours, not motion, and a
 * transition makes a reading depend on timing: every element carries one under
 * the reduced-motion rule in `global.css`, so a label's inherited ink can still
 * be on its old value after its tab has settled on the new one. Appended after
 * the imported stylesheet, so it wins the tie between two `!important` rules.
 */
beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = "*, *::before, *::after { transition-property: none !important; }";
  document.head.append(style);
});

/** Let a class change reach the page: two frames. */
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

async function mountAt(width: number) {
  authFetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(EMPTY_CUSTOMISATION), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  render(() => (
    <div style={{ width: `${width}px` }}>
      <InviteBuilder weddingId="wed_1" weddingSlug="anita-ben" entitlements={[]} />
    </div>
  ));
  await waitFor(() => screen.getByText("Save invite"));
  await settle();
}

const tab = (name: string | RegExp) => screen.getByRole("tab", { name });
/** A tab's visible label — its first child; the `sr-only` clause follows it. */
const labelOf = (name: string | RegExp) => tab(name).firstElementChild!;
const fmt = (n: number) => `${n.toFixed(2)}:1`;

/** Asserts a label clears 4.5:1 as painted, naming it and the ratio on failure. */
function expectReadable(label: Element, what: string) {
  const ratio = ratioOn(label);
  expect(ratio, `${what} measured ${fmt(ratio)}`).toBeGreaterThanOrEqual(WCAG_TEXT_MIN);
}

afterEach(async () => {
  cleanup();
  authFetchMock.mockReset();
  // The browser context is shared across tests in this file — a leaked
  // preference silently changes every assertion after it.
  await commands.emulateMedia({ colorScheme: "no-preference" });
});

describe("InviteBuilder section nav — hidden labels, as painted", () => {
  for (const scheme of ["dark", "light"] as const) {
    it(`strikes the tab row's hidden labels and keeps them readable, ${scheme}`, async () => {
      await commands.emulateMedia({ colorScheme: scheme });
      // Wide enough for the static tab row (`@3xl/builder`, 48rem).
      await mountAt(1200);

      // Selected and shown, not selected and shown: plain, and readable.
      expect(struck(labelOf("Design"))).toBe(false);
      expectReadable(labelOf("Design"), "selected tab");
      expect(struck(labelOf("Welcome"))).toBe(false);
      expectReadable(labelOf("Welcome"), "idle tab");

      // Not selected and hidden: struck, and as readable as the idle tab.
      expect(struck(labelOf(/^Hero/))).toBe(true);
      expectReadable(labelOf(/^Hero/), "hidden tab");

      // Selected and hidden: struck, and readable on the gold wash.
      tab(/^Hero/).click();
      await settle();
      expect(tab(/^Hero/).getAttribute("aria-selected")).toBe("true");
      expect(struck(labelOf(/^Hero/))).toBe(true);
      expectReadable(labelOf(/^Hero/), "selected hidden tab");
    });

    it(`strikes the menu's hidden labels and keeps them readable, ${scheme}`, async () => {
      await commands.emulateMedia({ colorScheme: scheme });
      // Narrow: the tabs collapse behind the trigger and open on their own
      // opaque panel, a different ground from the wide row's.
      await mountAt(480);
      const trigger = screen.getByRole("button", { name: /Choose a section/ });
      const triggerLabel = () => within(trigger).getByText(/^(Design|Hero)$/);
      expect(struck(triggerLabel())).toBe(false);
      expectReadable(triggerLabel(), "trigger label");

      // The collapsed tablist is `display: none`, out of the accessibility
      // tree, so open the menu first, as an organiser would.
      trigger.click();
      await settle();
      expect(struck(labelOf(/^Our Story/))).toBe(true);
      expectReadable(labelOf(/^Our Story/), "hidden tab in the menu");
      expectReadable(labelOf("Welcome"), "idle tab in the menu");

      tab(/^Hero/).click();
      await settle();
      expect(triggerLabel().textContent).toBe("Hero");
      expect(struck(triggerLabel())).toBe(true);
      expectReadable(triggerLabel(), "hidden trigger label");

      // Reopen: the selected, hidden tab on the wash over the menu panel.
      if (trigger.getAttribute("aria-expanded") !== "true") {
        trigger.click();
        await settle();
      }
      expect(struck(labelOf(/^Hero/))).toBe(true);
      expectReadable(labelOf(/^Hero/), "selected hidden tab in the menu");
    });
  }
});
