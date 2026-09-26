// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { HIDDEN_LABEL, isHiddenState, sectionTabTone } from "../../../src/components/invite/fields";

describe("isHiddenState", () => {
  it.each([
    [undefined, false],
    ["shown", false],
    ["empty", true],
    ["off", true],
  ] as const)("reads %s as hidden: %s", (state, hidden) => {
    expect(isHiddenState(state)).toBe(hidden);
  });
});

describe("sectionTabTone", () => {
  const tokens = (classes: string) => classes.split(/\s+/);

  it("gives the selected and unselected tabs different looks", () => {
    expect(sectionTabTone(true)).not.toBe(sectionTabTone(false));
  });

  it("puts the selection wash on the selected tab only", () => {
    expect(tokens(sectionTabTone(true))).toContain("bg-gold/12");
    expect(tokens(sectionTabTone(false))).not.toContain("bg-gold/12");
  });

  it("paints the selected tab in the readable gold, not the metal", () => {
    // `gold` carries no contrast contract; `gold-ink` is the gold for text.
    expect(tokens(sectionTabTone(true))).toContain("text-gold-ink");
    expect(tokens(sectionTabTone(true))).not.toContain("text-gold");
  });

  it("leaves the hidden mark out of the tone, so it can sit on either look", () => {
    // The strike is added to the label alongside the tone, never folded into
    // it: a hidden tab keeps the ink that makes its label readable.
    for (const selected of [true, false]) {
      expect(tokens(sectionTabTone(selected))).not.toContain(HIDDEN_LABEL);
    }
  });
});

describe("HIDDEN_LABEL", () => {
  it("is a text decoration, not an ink — the label keeps its contrast", () => {
    expect(HIDDEN_LABEL).toBe("line-through");
  });
});
