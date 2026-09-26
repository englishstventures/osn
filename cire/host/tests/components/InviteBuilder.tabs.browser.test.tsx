import { contrastRatio, WCAG_TEXT_MIN } from "@cire/theme";
import { cleanup, render, screen, waitFor, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";

import "../../src/styles/global.css";

/**
 * The section nav's faded labels, as painted.
 *
 * The fast tier proves a hidden section's tab carries the faded classes. It
 * cannot prove those classes emit any CSS, win the cascade, or leave the label
 * readable once the portal's translucent inks are composited over the sticky
 * bar, the builder card and the page — and it cannot prove the fade is far
 * enough from the idle ink to read as a state at all. Both need a stylesheet
 * and a compositor.
 *
 * The fade is held to 3:1, not the 4.5:1 WCAG 1.4.3 asks of text this small:
 * an ink that holds 4.5:1 is too close to the idle tab's to be seen as a
 * different state (see `sectionTabTone` in `src/components/invite/fields.tsx`).
 * So this pins both halves of that trade — the floor, and the separation that
 * justifies going under 4.5:1 in the first place.
 *
 * It mounts the real builder, so the classes measured are the ones the nav
 * renders, on the ancestors it really has.
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
/** How far apart two painted inks are, as a luminance ratio. */
const separation = (a: Element | string, b: Element | string) =>
  contrastRatio(
    typeof a === "string" ? a : paintedInk(a),
    typeof b === "string" ? b : paintedInk(b),
  )!;

/** The floor a faded label must still clear. */
const FADED_MIN = 3;

/** Let a class change paint: two frames, with transitions clamped to 0.01ms by
 *  the reduced-motion rule in `global.css`. */
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
const fmt = (n: number) => `${n.toFixed(2)}:1`;

afterEach(async () => {
  cleanup();
  authFetchMock.mockReset();
  // The browser context is shared across tests in this file — a leaked
  // preference silently changes every assertion after it.
  await commands.emulateMedia({ colorScheme: "no-preference", reducedMotion: "no-preference" });
});

describe("InviteBuilder section nav — faded labels, as painted", () => {
  for (const scheme of ["dark", "light"] as const) {
    it(`keeps the tab row's faded labels readable and apart from the idle ones, ${scheme}`, async () => {
      await commands.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      // Wide enough for the static tab row (`@3xl/builder`, 48rem).
      await mountAt(1200);

      // Selected and shown: the readable gold.
      const design = tab("Design");
      const selectedShownInk = paintedInk(design);
      expect(ratioOn(design), `selected tab ${fmt(ratioOn(design))}`).toBeGreaterThanOrEqual(
        WCAG_TEXT_MIN,
      );

      // Not selected: the hidden tab's fade clears 3:1, and sits far enough
      // under the idle ink to read as a state rather than a rounding error.
      const hero = tab(/^Hero/);
      const welcome = tab("Welcome");
      expect(ratioOn(hero), `faded tab ${fmt(ratioOn(hero))}`).toBeGreaterThanOrEqual(FADED_MIN);
      expect(ratioOn(welcome), `idle tab ${fmt(ratioOn(welcome))}`).toBeGreaterThanOrEqual(
        WCAG_TEXT_MIN,
      );
      expect(
        separation(hero, welcome),
        `faded vs idle ${fmt(separation(hero, welcome))}`,
      ).toBeGreaterThanOrEqual(1.5);

      // Selected and hidden: still over 3:1 on the gold wash, and visibly
      // fainter than a selected tab whose section shows.
      hero.click();
      await settle();
      expect(hero.getAttribute("aria-selected")).toBe("true");
      expect(ratioOn(hero), `selected faded tab ${fmt(ratioOn(hero))}`).toBeGreaterThanOrEqual(
        FADED_MIN,
      );
      expect(
        separation(hero, selectedShownInk),
        `selected faded vs selected shown ${fmt(separation(hero, selectedShownInk))}`,
      ).toBeGreaterThanOrEqual(1.3);
    });

    it(`keeps the menu trigger's faded label readable, ${scheme}`, async () => {
      await commands.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      // Narrow: the tabs collapse behind the trigger.
      await mountAt(480);
      const trigger = screen.getByRole("button", { name: /Choose a section/ });
      const label = () => within(trigger).getByText(/^(Design|Hero)$/);
      const shownInk = paintedInk(label());

      // The collapsed tablist is `display: none`, out of the accessibility
      // tree, so open the menu first, as an organiser would.
      trigger.click();
      await settle();
      tab(/^Hero/).click();
      await settle();
      expect(label().textContent).toBe("Hero");
      expect(
        ratioOn(label()),
        `faded trigger label ${fmt(ratioOn(label()))}`,
      ).toBeGreaterThanOrEqual(FADED_MIN);
      expect(
        separation(label(), shownInk),
        `faded vs unfaded trigger label ${fmt(separation(label(), shownInk))}`,
      ).toBeGreaterThanOrEqual(1.5);
    });
  }
});
