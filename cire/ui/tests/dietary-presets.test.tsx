import { DIETARY_PRESETS, type DietaryPreset } from "@cire/dietary";
import "@testing-library/jest-dom/vitest";
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DietaryPresets from "../src/dietary-presets";

/*
 * The picker's contract.
 *
 * Which shell renders is a real fork, so no test here leaves it to chance.
 * happy-dom answers `matchMedia` from a 1024px window, so the DEFAULT here is
 * the wide shell — a consumer's unit test that mounts a form containing this and
 * reaches straight for a checkbox finds a trigger button instead. {@link mockViewport}
 * makes the choice explicit in both directions.
 *
 * The popover's own behaviour — placement, dismiss, focus return — is Kobalte's
 * and is tested there; what matters here is that the trigger names the selection
 * and that the fields render at all.
 */

/**
 * Pin the viewport the picker asks about.
 *
 * A whole `MediaQueryList` rather than `{ matches }` alone: the picker
 * subscribes with `addEventListener`, and a stub without one throws at mount.
 */
function mockViewport(wide: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    addListener: () => {},
    removeListener: () => {},
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

function Harness(props: { initial?: readonly DietaryPreset[] }) {
  const [value, setValue] = createSignal<readonly DietaryPreset[]>(props.initial ?? []);
  return (
    <>
      <DietaryPresets value={value()} onChange={setValue} label="Dietary requirements for Ada" />
      <output data-testid="value">{value().join(",")}</output>
    </>
  );
}

const valueOf = () => screen.getByTestId("value").textContent;

let restoreViewport = () => {};
afterEach(() => {
  restoreViewport();
  restoreViewport = () => {};
  cleanup();
});

describe("DietaryPresets — narrow, the fields inline", () => {
  beforeEach(() => {
    restoreViewport = mockViewport(false);
  });

  it("renders every preset in the vocabulary as a checkbox", () => {
    render(() => <Harness />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(DIETARY_PRESETS.length);
  });

  it("names the group for whoever the requirements belong to", () => {
    // On a household sheet "Vegetarian" means nothing without "for Ada" — the
    // label is what keeps a screen reader's announcement attributable.
    render(() => <Harness />);
    expect(screen.getByRole("group", { name: "Dietary requirements for Ada" })).toBeTruthy();
  });

  it("selects more than one, which is the whole reason this is not a select", () => {
    render(() => <Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /vegetarian/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^nuts$/i }));
    expect(valueOf()).toBe("vegetarian,nuts");
  });

  it("hands back canonical order however it was clicked", () => {
    render(() => <Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^nuts$/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /vegetarian/i }));
    // Clicked nuts-first, stored diet-first: nothing downstream re-sorts, and
    // two guests who picked the same things produce the same stored string.
    expect(valueOf()).toBe("vegetarian,nuts");
  });

  it("reflects the value it is given, so a saved reply re-lights", () => {
    render(() => <Harness initial={["gluten", "other"]} />);
    expect((screen.getByRole("checkbox", { name: /gluten/i }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByRole("checkbox", { name: /^other$/i }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByRole("checkbox", { name: /vegan/i }) as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("deselects", () => {
    render(() => <Harness initial={["vegetarian"]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /vegetarian/i }));
    expect(valueOf()).toBe("");
  });

  it("disables every checkbox when the form is locked", () => {
    render(() => (
      <DietaryPresets value={[]} onChange={() => {}} disabled label="Dietary requirements" />
    ));
    for (const box of screen.getAllByRole("checkbox")) {
      expect((box as HTMLInputElement).disabled).toBe(true);
    }
  });

  it("groups the bands, so an allergy does not read as a preference", () => {
    // A caterer isolates for an allergy and plates for a diet. The headings are
    // what carry that difference to the guest choosing.
    render(() => <Harness />);
    expect(screen.getByText("Diet")).toBeTruthy();
    expect(screen.getByText("Allergies")).toBeTruthy();
  });

  it("mounts where matchMedia does not exist rather than throwing", () => {
    restoreViewport();
    restoreViewport = () => {};
    // jsdom has none, and that is what every consumer's unit suite runs on. An
    // unguarded `window.matchMedia(...)` here would fail at the first mount of
    // any form containing the picker — not just this package's own tests — so
    // the absence is asserted rather than assumed.
    const original = window.matchMedia;
    // @ts-expect-error — deleting a DOM global is the situation being reproduced.
    delete window.matchMedia;
    try {
      expect(() => render(() => <Harness />)).not.toThrow();
      // And it falls back to the shell that needs no viewport question answered.
      expect(screen.getAllByRole("checkbox")).toHaveLength(DIETARY_PRESETS.length);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("DietaryPresets — wide, the fields behind a trigger", () => {
  beforeEach(() => {
    restoreViewport = mockViewport(true);
  });

  it("collapses to a trigger rather than sixteen pills across the form", () => {
    render(() => <Harness />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /add dietary requirements/i })).toBeTruthy();
  });

  it("names the current selection on the closed trigger", () => {
    // A closed control that says only "Dietary requirements" makes a guest open
    // it to find out what they already picked, every single time.
    render(() => <Harness initial={["vegetarian", "nuts"]} />);
    expect(screen.getByRole("button", { name: /vegetarian, nuts/i })).toBeTruthy();
  });

  it("truncates a long selection so the trigger cannot outgrow its row", () => {
    render(() => <Harness initial={["vegetarian", "nuts", "gluten", "egg"]} />);
    expect(screen.getByRole("button", { name: /vegetarian, nuts \+2/i })).toBeTruthy();
  });

  it("disables the trigger when the form is locked", () => {
    render(() => <DietaryPresets value={[]} onChange={() => {}} disabled />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
